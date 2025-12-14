import { z } from "zod";
import { ROLE } from "@/types/enums";

/**
 * Auth Validators
 */

// Login validator
export const loginValidator = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});

// Register validator
export const registerValidator = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    role: z.nativeEnum(ROLE).optional().default(ROLE.USER),
    companyName: z.string().optional(), // For advertisers
  }),
});

// Verify email validator
export const verifyEmailValidator = z.object({
  body: z.object({
    token: z.string().min(1, "Verification token is required"),
  }),
});

// Resend verification validator (no body needed, just auth)
export const resendVerificationValidator = z.object({
  body: z.object({}).optional(),
});

// Update profile validator
export const updateProfileValidator = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email format").optional(),
    avatar: z.string().url("Invalid URL format").optional(),
  }),
});

// Change password validator
export const changePasswordValidator = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
  }),
});

// Export types
export type LoginInput = z.infer<typeof loginValidator>["body"];
export type RegisterInput = z.infer<typeof registerValidator>["body"];
export type VerifyEmailInput = z.infer<typeof verifyEmailValidator>["body"];
export type UpdateProfileInput = z.infer<typeof updateProfileValidator>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordValidator>["body"];
