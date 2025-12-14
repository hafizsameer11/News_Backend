import { Request, Response } from "express";
import { AdService } from "@/services/ad.service";
import { successResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";

const adService = new AdService();

export const adController = {
  getAll: async (req: AuthenticatedRequest, res: Response) => {
    // If public (no token), userId/role will be undefined
    const result = await adService.getAds(req.query, req.user?.id, req.user?.role);
    return successResponse(res, "Ads retrieved", result);
  },

  create: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await adService.createAd(req.body, req.user.id);
    return successResponse(res, "Ad created", result, 201);
  },

  update: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await adService.updateAd(req.params.id, req.body, req.user.id, req.user.role);
    return successResponse(res, "Ad updated", result);
  },

  createPayment: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await adService.createPaymentIntent(req.params.id, req.user.id);
    return successResponse(res, "Payment intent created", result);
  },

  trackImpression: async (req: Request, res: Response) => {
    await adService.trackImpression(req.params.id);
    return successResponse(res, "Impression tracked");
  },

  trackClick: async (req: Request, res: Response) => {
    await adService.trackClick(req.params.id);
    return successResponse(res, "Click tracked");
  },

  delete: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    await adService.deleteAd(req.params.id, req.user.id, req.user.role);
    return successResponse(res, "Ad deleted");
  },

  approve: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await adService.approveAd(req.params.id);
    return successResponse(res, "Ad approved", result);
  },

  reject: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await adService.rejectAd(req.params.id, req.body.reason);
    return successResponse(res, "Ad rejected", result);
  },

  pause: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await adService.pauseAd(req.params.id, req.user.id, req.user.role);
    return successResponse(res, "Ad paused", result);
  },

  resume: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await adService.resumeAd(req.params.id, req.user.id, req.user.role);
    return successResponse(res, "Ad resumed", result);
  },

  getAnalytics: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await adService.getAdAnalytics(req.params.id, req.user.id, req.user.role);
    return successResponse(res, "Ad analytics retrieved", result);
  },

  getAdvertiserAnalytics: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await adService.getAdvertiserAnalytics(req.user.id);
    return successResponse(res, "Advertiser analytics retrieved", result);
  },
};
