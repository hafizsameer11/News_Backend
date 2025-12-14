import { Request, Response } from "express";
import { StatsService } from "@/services/stats.service";
import { ExportService, ExportType, ExportFormat } from "@/services/export.service";
import { AnalyticsDashboardService } from "@/services/analytics-dashboard.service";
import { successResponse, errorResponse } from "@/utils/response";

const statsService = new StatsService();
const exportService = new ExportService();
const dashboardService = new AnalyticsDashboardService();

export const statsController = {
  getStats: async (_req: Request, res: Response) => {
    try {
      const result = await statsService.getAdminStats();
      return successResponse(res, "Admin stats retrieved", result);
    } catch (error: any) {
      return errorResponse(res, error.message || "Failed to retrieve stats", null, 500);
    }
  },

  getTrends: async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as "daily" | "weekly" | "monthly") || "daily";
      const result = await statsService.getTrends(period);
      return successResponse(res, "Trends retrieved", result);
    } catch (error: any) {
      return errorResponse(res, error.message || "Failed to retrieve trends", null, 500);
    }
  },

  getNewsPopularity: async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 10;
      const result = await statsService.getNewsPopularity(limit);
      return successResponse(res, "News popularity retrieved", result);
    } catch (error: any) {
      return errorResponse(res, error.message || "Failed to retrieve news popularity", null, 500);
    }
  },

  getUserEngagement: async (_req: Request, res: Response) => {
    try {
      const result = await statsService.getUserEngagement();
      return successResponse(res, "User engagement metrics retrieved", result);
    } catch (error: any) {
      return errorResponse(res, error.message || "Failed to retrieve user engagement", null, 500);
    }
  },

  getCategoryPerformance: async (_req: Request, res: Response) => {
    try {
      const result = await statsService.getCategoryPerformance();
      return successResponse(res, "Category performance retrieved", result);
    } catch (error: any) {
      return errorResponse(
        res,
        error.message || "Failed to retrieve category performance",
        null,
        500
      );
    }
  },

  getConversionMetrics: async (_req: Request, res: Response) => {
    try {
      const result = await statsService.getConversionMetrics();
      return successResponse(res, "Conversion metrics retrieved", result);
    } catch (error: any) {
      return errorResponse(
        res,
        error.message || "Failed to retrieve conversion metrics",
        null,
        500
      );
    }
  },

  exportData: async (req: Request, res: Response) => {
    try {
      const type = req.params.type as ExportType;
      const format = (req.query.format as ExportFormat) || "csv";
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      if (!["audit-logs", "user-behavior", "news-views", "ad-analytics"].includes(type)) {
        return errorResponse(res, "Invalid export type", null, 400);
      }

      if (format !== "csv" && format !== "json") {
        return errorResponse(res, "Invalid format. Use 'csv' or 'json'", null, 400);
      }

      const data = await exportService.export(type, format, {
        startDate,
        endDate,
        limit,
      });

      // Set appropriate headers
      const contentType = format === "csv" ? "text/csv" : "application/json";
      const extension = format === "csv" ? "csv" : "json";
      const filename = `${type}-${new Date().toISOString().split("T")[0]}.${extension}`;

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      return res.send(data);
    } catch (error: any) {
      return errorResponse(res, error.message || "Failed to export data", null, 500);
    }
  },

  getDashboard: async (_req: Request, res: Response) => {
    try {
      const result = await dashboardService.getDashboardData();
      return successResponse(res, "Dashboard data retrieved", result);
    } catch (error: any) {
      return errorResponse(res, error.message || "Failed to retrieve dashboard data", null, 500);
    }
  },
};
