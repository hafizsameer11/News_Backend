import { Router } from "express";
import { structuredDataController } from "@/controllers/structured-data.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { validate } from "@/middleware/validate";
import { seoValidators } from "@/validators/seo.validators";

const router = Router();

/**
 * @openapi
 * /seo/news/{slug}/structured-data:
 *   get:
 *     tags:
 *       - SEO
 *     summary: Get NewsArticle JSON-LD structured data
 *     description: Returns JSON-LD structured data for a news article following schema.org NewsArticle specification
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: News article slug
 *     responses:
 *       200:
 *         description: NewsArticle structured data
 *         content:
 *           application/ld+json:
 *             schema:
 *               type: object
 *       404:
 *         description: News article not found
 */
router.get(
  "/news/:slug/structured-data",
  validate(seoValidators.newsSlug),
  asyncHandler(structuredDataController.getNewsArticle)
);

/**
 * @openapi
 * /seo/category/{slug}/structured-data:
 *   get:
 *     tags:
 *       - SEO
 *     summary: Get CollectionPage JSON-LD structured data
 *     description: Returns JSON-LD structured data for a category page following schema.org CollectionPage specification
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Category slug
 *     responses:
 *       200:
 *         description: CollectionPage structured data
 *         content:
 *           application/ld+json:
 *             schema:
 *               type: object
 *       404:
 *         description: Category not found
 */
router.get(
  "/category/:slug/structured-data",
  validate(seoValidators.categorySlug),
  asyncHandler(structuredDataController.getCategory)
);

/**
 * @openapi
 * /seo/homepage/structured-data:
 *   get:
 *     tags:
 *       - SEO
 *     summary: Get WebSite/Organization JSON-LD structured data
 *     description: Returns JSON-LD structured data for the homepage following schema.org WebSite and Organization specifications
 *     responses:
 *       200:
 *         description: WebSite structured data
 *         content:
 *           application/ld+json:
 *             schema:
 *               type: object
 */
router.get("/homepage/structured-data", asyncHandler(structuredDataController.getHomepage));

export default router;
