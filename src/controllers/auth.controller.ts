import { Request, Response } from "express";
import { AuthService } from "@/services/auth.service";
import { successResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";

const authService = new AuthService();

export const authController = {
  register: async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    return successResponse(res, "Registration successful", result, 201);
  },

  login: async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    return successResponse(res, "Login successful", result);
  },

  getMe: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Not authenticated");
    }
    const result = await authService.getProfile(req.user.id);
    return successResponse(res, "User profile retrieved", result);
  },

  verifyEmail: async (req: Request, res: Response) => {
    const { token } = req.body;
    const result = await authService.verifyEmail(token);
    return successResponse(res, result.message, result);
  },

  resendVerification: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Not authenticated");
    }
    const result = await authService.resendVerificationEmail(req.user.id);
    return successResponse(res, result.message, result);
  },

  updateProfile: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Not authenticated");
    }
    const result = await authService.updateProfile(req.user.id, req.body);
    return successResponse(res, "Profile updated successfully", result);
  },

  changePassword: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new Error("Not authenticated");
    }
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    return successResponse(res, result.message, result);
  },
};
