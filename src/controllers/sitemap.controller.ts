import { Request, Response } from "express";
import { SitemapService } from "@/services/sitemap.service";

const sitemapService = new SitemapService();

export const sitemapController = {
  /**
   * Generate and return sitemap.xml
   */
  getSitemap: async (_req: Request, res: Response) => {
    try {
      const xml = await sitemapService.generateSitemap();
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
      return res.send(xml);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate sitemap",
        error: error.message,
      });
    }
  },
};
