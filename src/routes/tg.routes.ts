import { Router } from "express";
import { tgController } from "@/controllers/tg.controller";
import { asyncHandler } from "@/middleware/asyncHandler";

const router = Router();

// Public Access - TG News
router.get("/", asyncHandler(tgController.getAll));
router.get("/featured", asyncHandler(tgController.getFeatured));
router.get("/latest", asyncHandler(tgController.getLatest));

// Public Access - TG Videos
/**
 * @openapi
 * /tg/videos:
 *   get:
 *     tags:
 *       - TG Videos
 *     summary: Get all TG videos
 *     description: Retrieve all TG videos with pagination, filtering, and sorting options.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, duration]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
 */
router.get("/videos", asyncHandler(tgController.getAllVideos));

/**
 * @openapi
 * /tg/videos/popular:
 *   get:
 *     tags:
 *       - TG Videos
 *     summary: Get popular TG videos
 *     description: Get popular TG videos (currently returns latest videos).
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of videos to return
 *     responses:
 *       200:
 *         description: Popular videos retrieved successfully
 */
router.get("/videos/popular", asyncHandler(tgController.getPopularVideos));

/**
 * @openapi
 * /tg/videos/related/{id}:
 *   get:
 *     tags:
 *       - TG Videos
 *     summary: Get related videos
 *     description: Get related TG videos from the same category.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 6
 *         description: Number of related videos to return
 *     responses:
 *       200:
 *         description: Related videos retrieved successfully
 *       404:
 *         description: Video not found
 */
router.get("/videos/related/:id", asyncHandler(tgController.getRelatedVideos));

/**
 * @openapi
 * /tg/videos/{id}:
 *   get:
 *     tags:
 *       - TG Videos
 *     summary: Get single TG video
 *     description: Retrieve a single TG video with full details including news article, category, and author.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Video retrieved successfully
 *       404:
 *         description: Video not found
 */
router.get("/videos/:id", asyncHandler(tgController.getVideoById));

// Note: Creating/Updating TG news is done via standard News API
// by setting `isTG: true`

export default router;
