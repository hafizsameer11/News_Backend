import { Request, Response } from "express";
import { StructuredDataService } from "@/services/structured-data.service";
import { successResponse } from "@/utils/response";

const structuredDataService = new StructuredDataService();

export const structuredDataController = {
  /**
   * Get NewsArticle structured data
   */
  getNewsArticle: async (req: Request, res: Response) => {
    const { slug } = req.params;
    const data = await structuredDataService.getNewsArticleStructuredData(slug);
    res.setHeader("Content-Type", "application/ld+json");
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    return successResponse(res, "NewsArticle structured data", data);
  },

  /**
   * Get CollectionPage structured data for category
   */
  getCategory: async (req: Request, res: Response) => {
    const { slug } = req.params;
    const data = await structuredDataService.getCategoryStructuredData(slug);
    res.setHeader("Content-Type", "application/ld+json");
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    return successResponse(res, "CollectionPage structured data", data);
  },

  /**
   * Get WebSite/Organization structured data for homepage
   */
  getHomepage: async (_req: Request, res: Response) => {
    const data = structuredDataService.getWebSiteStructuredData();
    res.setHeader("Content-Type", "application/ld+json");
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    return successResponse(res, "WebSite structured data", data);
  },
};
