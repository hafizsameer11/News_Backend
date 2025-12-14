import { z } from "zod";

/**
 * Password Validators
 */

// Forgot password validator
export const forgotPasswordValidator = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

// Reset password validator
export const resetPasswordValidator = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});

// Export types
export type ForgotPasswordInput = z.infer<typeof forgotPasswordValidator>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordValidator>["body"];
