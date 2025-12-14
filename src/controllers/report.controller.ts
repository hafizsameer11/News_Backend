import { Request, Response } from "express";
import { ReportService } from "@/services/report.service";
import { UserBehaviorService } from "@/services/user-behavior.service";
import { successResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";

const reportService = new ReportService();
const userBehaviorService = new UserBehaviorService();

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string | undefined {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    undefined
  );
}

export const reportController = {
  create: async (req: AuthenticatedRequest, res: Response) => {
    const result = await reportService.createReport(req.body, req.user?.id);

    // Track report submission behavior
    try {
      const ipAddress = getClientIp(req);
      const userAgent = req.headers["user-agent"] || undefined;
      await userBehaviorService.trackReportSubmit(result.id, {
        userId: req.user?.id,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      // Log error but don't break the request flow
      console.error("Failed to track report submission:", error);
    }

    return successResponse(res, "Report submitted successfully", result, 201);
  },

  getAll: async (req: Request, res: Response) => {
    const result = await reportService.getAllReports(req.query);
    return successResponse(res, "Reports retrieved", result);
  },

  resolve: async (req: AuthenticatedRequest, res: Response) => {
    const result = await reportService.resolveReport(req.params.id);
    return successResponse(res, "Report marked as resolved", result);
  },
};
