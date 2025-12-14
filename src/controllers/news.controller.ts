import { Request, Response } from "express";
import { NewsService } from "@/services/news.service";
import { successResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";

const newsService = new NewsService();

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

export const newsController = {
  getAll: async (req: Request, res: Response) => {
    const result = await newsService.getAllNews(req.query);
    return successResponse(res, "News retrieved", result);
  },

  getOne: async (req: Request | AuthenticatedRequest, res: Response) => {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || undefined;
    const userId = (req as AuthenticatedRequest).user?.id;

    const result = await newsService.getNewsByIdOrSlug(req.params.idOrSlug, {
      userId,
      ipAddress,
      userAgent,
    });
    return successResponse(res, "News retrieved", result);
  },

  create: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await newsService.createNews(req.body, req.user.id);
    return successResponse(res, "News created", result, 201);
  },

  update: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await newsService.updateNews(
      req.params.id,
      req.body,
      req.user.id,
      req.user.role
    );
    return successResponse(res, "News updated", result);
  },

  delete: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    await newsService.deleteNews(req.params.id, req.user.id, req.user.role);
    return successResponse(res, "News deleted");
  },
};
