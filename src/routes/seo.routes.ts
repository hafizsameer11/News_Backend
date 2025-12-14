import { Router } from "express";
import { seoController } from "@/controllers/seo.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { validate } from "@/middleware/validate";
import { seoValidators } from "@/validators/seo.validators";

const router = Router();

/**
 * @openapi
 * /seo/news/{slug}:
 *   get:
 *     tags:
 *       - SEO
 *     summary: Get SEO metadata for a news article
 *     description: Returns SEO metadata including title, description, OpenGraph, Twitter Card, and article metadata
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: News article slug
 *     responses:
 *       200:
 *         description: SEO metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 keywords:
 *                   type: array
 *                   items:
 *                     type: string
 *                 canonicalUrl:
 *                   type: string
 *                 openGraph:
 *                   type: object
 *                 twitterCard:
 *                   type: object
 *                 article:
 *                   type: object
 *       404:
 *         description: News article not found
 */
router.get(
  "/news/:slug",
  validate(seoValidators.newsSlug),
  asyncHandler(seoController.getNewsMetadata)
);

/**
 * @openapi
 * /seo/category/{slug}:
 *   get:
 *     tags:
 *       - SEO
 *     summary: Get SEO metadata for a category page
 *     description: Returns SEO metadata including title, description, OpenGraph, and Twitter Card
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Category slug
 *     responses:
 *       200:
 *         description: SEO metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Category not found
 */
router.get(
  "/category/:slug",
  validate(seoValidators.categorySlug),
  asyncHandler(seoController.getCategoryMetadata)
);

/**
 * @openapi
 * /seo/homepage:
 *   get:
 *     tags:
 *       - SEO
 *     summary: Get SEO metadata for homepage
 *     description: Returns SEO metadata for the homepage including title, description, OpenGraph, and Twitter Card
 *     responses:
 *       200:
 *         description: SEO metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get("/homepage", asyncHandler(seoController.getHomepageMetadata));

export default router;
