import { Router } from "express";
import { newsController } from "@/controllers/news.controller";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import { createNewsValidator, updateNewsValidator } from "@/validators/news.validators";

const router = Router();

/**
 * @openapi
 * tags:
 *   name: News
 *   description: News article management
 */

/**
 * @openapi
 * /news:
 *   get:
 *     tags: [News]
 *     summary: Get all news (with filters)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of news
 */
router.get("/", asyncHandler(newsController.getAll));

/**
 * @openapi
 * /news/{idOrSlug}:
 *   get:
 *     tags: [News]
 *     summary: Get news by ID or Slug
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: News details
 */
router.get("/:idOrSlug", asyncHandler(newsController.getOne));

// Protected Routes (Admin, Editor, Super Admin)
router.use(authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.EDITOR]));

/**
 * @openapi
 * /news:
 *   post:
 *     tags: [News]
 *     summary: Create news article
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - categoryId
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               summary:
 *                 type: string
 *               content:
 *                 type: string
 *               categoryId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, PENDING_REVIEW]
 *     responses:
 *       201:
 *         description: News created
 */
router.post("/", validate(createNewsValidator), asyncHandler(newsController.create));

/**
 * @openapi
 * /news/{id}:
 *   patch:
 *     tags: [News]
 *     summary: Update news article
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: News updated
 */
router.patch("/:id", validate(updateNewsValidator), asyncHandler(newsController.update));

/**
 * @openapi
 * /news/{id}:
 *   delete:
 *     tags: [News]
 *     summary: Delete news article
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: News deleted
 */
router.delete("/:id", asyncHandler(newsController.delete));

export default router;
