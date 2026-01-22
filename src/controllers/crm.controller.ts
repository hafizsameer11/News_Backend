import { Response } from "express";
import { crmService } from "@/services/crm.service";
import { successResponse, errorResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";

export const crmController = {
  registerUser: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return errorResponse(res, "Unauthorized", null, 401);
    }
    const result = await crmService.registerUser(req.body);
    return successResponse(res, "User registered successfully", result, 201);
  },

  getCategories: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return errorResponse(res, "Unauthorized", null, 401);
    }
    const result = await crmService.getCategories();
    return successResponse(res, "Categories retrieved successfully", result);
  },

  createNews: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return errorResponse(res, "Unauthorized", null, 401);
    }
    const result = await crmService.createNews(req.body, req.user.id);
    return successResponse(res, "News created successfully", result, 201);
  },

  createAd: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return errorResponse(res, "Unauthorized", null, 401);
    }
    const result = await crmService.createAd(req.body, req.user.id);
    return successResponse(res, "Ad created and auto-approved successfully", result, 201);
  },
};
