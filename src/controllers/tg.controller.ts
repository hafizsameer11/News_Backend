import { Request, Response } from "express";
import { TGService } from "@/services/tg.service";
import { successResponse } from "@/utils/response";

const tgService = new TGService();

export const tgController = {
  getAll: async (req: Request, res: Response) => {
    const result = await tgService.getAllTG(req.query);
    return successResponse(res, "TG news retrieved", result);
  },

  getFeatured: async (_req: Request, res: Response) => {
    const result = await tgService.getFeaturedTG();
    return successResponse(res, "Featured TG news retrieved", result);
  },

  getLatest: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 6;
    const result = await tgService.getLatestTG(limit);
    return successResponse(res, "Latest TG news retrieved", result);
  },

  getAllVideos: async (req: Request, res: Response) => {
    const result = await tgService.getAllVideos(req.query);
    return successResponse(res, "TG videos retrieved", result);
  },

  getVideoById: async (req: Request, res: Response) => {
    const result = await tgService.getVideoById(req.params.id);
    return successResponse(res, "TG video retrieved", result);
  },

  getRelatedVideos: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 6;
    const result = await tgService.getRelatedVideos(req.params.id, limit);
    return successResponse(res, "Related videos retrieved", result);
  },

  getPopularVideos: async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 10;
    const result = await tgService.getPopularVideos(limit);
    return successResponse(res, "Popular videos retrieved", result);
  },
};
