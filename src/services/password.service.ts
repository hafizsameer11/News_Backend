import prisma from "@/config/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { emailService } from "./email.service";
import { logger } from "@/utils/logger";

export class PasswordService {
  /**
   * Request Password Reset
   * Generates a token, stores it in DB, and queues email
   */
  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Don't reveal user existence for security
    if (!user) {
      return { message: "If email exists, reset link sent." };
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");
    // Hash token for DB storage
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const expiresIn = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expiresIn,
      },
    });

    // Send email via service (non-blocking)
    try {
      await emailService.sendPasswordResetEmail(email, resetToken);
    } catch (error) {
      // Log error but don't fail the request
      logger.error("Failed to send password reset email:", error);
    }

    return { message: "If email exists, reset link sent." };
  }

  /**
   * Verify reset token
   */
  async verifyResetToken(token: string): Promise<{ valid: boolean; user?: any }> {
    if (!token) {
      return { valid: false };
    }

    // Hash the provided token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with matching token that hasn't expired
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: {
          gt: new Date(), // Token hasn't expired
        },
      },
    });

    if (!user) {
      return { valid: false };
    }

    return { valid: true, user };
  }

  /**
   * Reset Password
   */
  async resetPassword(token: string, newPassword: string) {
    // Verify token
    const { valid, user } = await this.verifyResetToken(token);

    if (!valid || !user) {
      throw new Error("Invalid or expired reset token");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    logger.info(`Password reset successful for user: ${user.email}`);

    return { message: "Password reset successfully" };
  }
}
