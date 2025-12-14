import { Router } from "express";
import { sitemapController } from "@/controllers/sitemap.controller";
import { asyncHandler } from "@/middleware/asyncHandler";

const router = Router();

/**
 * @openapi
 * /sitemap.xml:
 *   get:
 *     tags:
 *       - SEO
 *     summary: Get sitemap.xml
 *     description: Returns XML sitemap with all published news articles, categories, and static pages
 *     responses:
 *       200:
 *         description: Sitemap XML
 *         content:
 *           application/xml:
 *             schema:
 *               type: string
 *               example: |
 *                 <?xml version="1.0" encoding="UTF-8"?>
 *                 <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 *                   <url>
 *                     <loc>http://localhost:3000</loc>
 *                     <changefreq>daily</changefreq>
 *                     <priority>1.0</priority>
 *                   </url>
 *                 </urlset>
 */
router.get("/", asyncHandler(sitemapController.getSitemap));

export default router;
