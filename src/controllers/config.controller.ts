import { Request, Response } from "express";
import { successResponse } from "@/utils/response";
import env from "@/config/env";

export const configController = {
  /**
   * Get public configuration
   * This endpoint returns public configuration that the frontend needs
   */
  getPublicConfig: async (_req: Request, res: Response) => {
    const config = {
      enableEmailVerification: env.ENABLE_EMAIL_VERIFICATION,
      frontendUrl: env.FRONTEND_URL,
      siteName: env.SITE_NAME,
    };

    return successResponse(res, "Public configuration retrieved", config);
  },
};
