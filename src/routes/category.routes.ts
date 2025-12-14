import { Router } from "express";
import { categoryController } from "@/controllers/category.controller";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import { createCategoryValidator, updateCategoryValidator } from "@/validators/category.validators";

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Categories
 *   description: Category management
 */

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: Get all categories
 *     parameters:
 *       - in: query
 *         name: flat
 *         schema:
 *           type: boolean
 *         description: If true, returns flat list instead of hierarchy
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get("/", asyncHandler(categoryController.getAll));

/**
 * @openapi
 * /categories/slug/{slug}:
 *   get:
 *     tags: [Categories]
 *     summary: Get category by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Category slug
 *     responses:
 *       200:
 *         description: Category details
 *       404:
 *         description: Category not found
 */
router.get("/slug/:slug", asyncHandler(categoryController.getBySlug));

/**
 * @openapi
 * /categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: Get category by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category details
 */
router.get("/:id", asyncHandler(categoryController.getOne));

// Admin only for management
router.use(authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]));

/**
 * @openapi
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create new category
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nameEn
 *               - nameIt
 *               - slug
 *             properties:
 *               nameEn:
 *                 type: string
 *               nameIt:
 *                 type: string
 *               slug:
 *                 type: string
 *               parentId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created
 */
router.post("/", validate(createCategoryValidator), asyncHandler(categoryController.create));

/**
 * @openapi
 * /categories/order:
 *   patch:
 *     tags: [Categories]
 *     summary: Update category order (bulk)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - order
 *                   properties:
 *                     id:
 *                       type: string
 *                     order:
 *                       type: number
 *     responses:
 *       200:
 *         description: Category order updated
 */
router.patch("/order", asyncHandler(categoryController.updateOrder));

/**
 * @openapi
 * /categories/{id}:
 *   patch:
 *     tags: [Categories]
 *     summary: Update category
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
 *               nameEn:
 *                 type: string
 *               nameIt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated
 */
router.patch("/:id", validate(updateCategoryValidator), asyncHandler(categoryController.update));

/**
 * @openapi
 * /categories/{id}:
 *   delete:
 *     tags: [Categories]
 *     summary: Delete category
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
 *         description: Category deleted
 */
router.delete("/:id", asyncHandler(categoryController.delete));

export default router;
