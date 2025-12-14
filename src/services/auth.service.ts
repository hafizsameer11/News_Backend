import prisma from "@/config/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateToken } from "@/utils/jwt";
import { LoginInput, RegisterInput } from "@/validators/auth.validators";
import { ROLE } from "@/types/enums";
import { ga4Client } from "@/lib/ga4-client";
import { emailService } from "./email.service";
import { logger } from "@/utils/logger";
import env from "@/config/env";

export class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterInput) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Check if email verification is enabled
    const isEmailVerificationEnabled = env.ENABLE_EMAIL_VERIFICATION;

    // Prepare user data
    const userData: any = {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role as any, // Type casting for Prisma enum
      companyName: data.companyName,
      isActive: true,
      emailVerified: !isEmailVerificationEnabled, // Auto-verify if verification is disabled
    };

    let verificationToken: string | null = null;

    // Only generate verification token if email verification is enabled
    if (isEmailVerificationEnabled) {
      verificationToken = crypto.randomBytes(32).toString("hex");
      const hashedVerificationToken = crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex");
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      userData.emailVerificationToken = hashedVerificationToken;
      userData.emailVerificationExpires = verificationExpires;
    }

    // Create user
    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
    });

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role as unknown as ROLE,
    });

    // Send verification email only if email verification is enabled
    if (isEmailVerificationEnabled && verificationToken) {
      setImmediate(async () => {
        try {
          const emailSent = await emailService.sendVerificationEmail(
            data.email,
            verificationToken!
          );
          if (!emailSent) {
            logger.error(
              `Failed to send verification email to ${data.email}. Check email service configuration and Resend domain verification.`
            );
          } else {
            logger.info(`Verification email sent successfully to ${data.email}`);
          }
        } catch (error: any) {
          logger.error(`Failed to send verification email to ${data.email}:`, {
            error: error.message,
            stack: error.stack,
            emailProvider: env.EMAIL_PROVIDER,
            fromAddress: env.EMAIL_FROM_ADDRESS,
          });
        }
      });
    }

    // Track user sign up in GA4 (asynchronously)
    setImmediate(async () => {
      try {
        await ga4Client.trackSignUp(user.id, "email");
      } catch (error) {
        // Log error but don't break the registration flow
        console.error("Failed to track GA4 sign up:", error);
      }
    });

    return { user, token };
  }

  /**
   * Login user
   */
  async login(data: LoginInput) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Check active status
    if (!user.isActive) {
      throw new Error("Account is disabled. Please contact admin.");
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.password);

    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role as unknown as ROLE,
    });

    // Get user with allowed categories
    const userWithCategories = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        allowedCategories: {
          select: {
            id: true,
            nameEn: true,
            nameIt: true,
            slug: true,
          },
        },
      },
    });

    if (!userWithCategories) {
      throw new Error("User not found");
    }

    // Return user info (excluding password)
    const { password: _password, ...userWithoutPassword } = userWithCategories;

    return { user: userWithoutPassword, token };
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        companyName: true,
        allowedCategories: {
          select: {
            id: true,
            nameEn: true,
            nameIt: true,
            slug: true,
          },
        },
        socialPostingAllowed: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string) {
    // Check if email verification is enabled
    if (!env.ENABLE_EMAIL_VERIFICATION) {
      throw new Error("Email verification is disabled");
    }

    if (!token) {
      throw new Error("Verification token is required");
    }

    // Hash the provided token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with matching token that hasn't expired
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: hashedToken,
        emailVerificationExpires: {
          gt: new Date(), // Token hasn't expired
        },
      },
    });

    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    // Update user to verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    logger.info(`Email verified for user: ${user.email}`);

    return { message: "Email verified successfully" };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(userId: string) {
    // Check if email verification is enabled
    if (!env.ENABLE_EMAIL_VERIFICATION) {
      throw new Error("Email verification is disabled");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.emailVerified) {
      throw new Error("Email already verified");
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashedVerificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Send verification email (non-blocking)
    setImmediate(async () => {
      try {
        const emailSent = await emailService.sendVerificationEmail(user.email, verificationToken);
        if (!emailSent) {
          logger.error(
            `Failed to send verification email to ${user.email}. Check email service configuration and Resend domain verification.`
          );
        } else {
          logger.info(`Verification email sent successfully to ${user.email}`);
        }
      } catch (error: any) {
        logger.error(`Failed to send verification email to ${user.email}:`, {
          error: error.message,
          stack: error.stack,
          emailProvider: env.EMAIL_PROVIDER,
          fromAddress: env.EMAIL_FROM_ADDRESS,
        });
      }
    });

    return { message: "Verification email sent" };
  }

  /**
   * Update user profile (own profile)
   */
  async updateProfile(userId: string, data: { name?: string; email?: string; avatar?: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // If email is being changed, check if it's already taken
    if (data.email && data.email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error("Email already registered");
      }

      // If email changed, reset verification status
      data = {
        ...data,
        emailVerified: false,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      } as any;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email, emailVerified: false }),
        ...(data.avatar && { avatar: data.avatar }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        companyName: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  /**
   * Change password (own password)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    logger.info(`Password changed for user: ${user.email}`);

    return { message: "Password changed successfully" };
  }
}
