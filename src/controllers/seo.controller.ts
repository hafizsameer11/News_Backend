import { Request, Response } from "express";
import { SEOService } from "@/services/seo.service";
import { successResponse } from "@/utils/response";

const seoService = new SEOService();

export const seoController = {
  /**
   * Get SEO metadata for a news article
   */
  getNewsMetadata: async (req: Request, res: Response) => {
    const { slug } = req.params;
    const metadata = await seoService.getNewsMetadata(slug);
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    return successResponse(res, "News SEO metadata", metadata);
  },

  /**
   * Get SEO metadata for a category page
   */
  getCategoryMetadata: async (req: Request, res: Response) => {
    const { slug } = req.params;
    const metadata = await seoService.getCategoryMetadata(slug);
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    return successResponse(res, "Category SEO metadata", metadata);
  },

  /**
   * Get SEO metadata for homepage
   */
  getHomepageMetadata: async (_req: Request, res: Response) => {
    const metadata = seoService.getHomepageMetadata();
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    return successResponse(res, "Homepage SEO metadata", metadata);
  },
};
