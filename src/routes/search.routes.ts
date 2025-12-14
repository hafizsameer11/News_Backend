import { Router } from "express";
import { searchController } from "@/controllers/search.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { validate } from "@/middleware/validate";
import { searchValidators } from "@/validators/search.validators";

const router = Router();

/**
 * @openapi
 * /search:
 *   get:
 *     tags:
 *       - Search
 *     summary: Enhanced search with filters, sorting, and pagination
 *     description: Search across news, categories, and transport with advanced filtering options
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (minimum 2 characters)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [news, category, transport, all]
 *         description: "Filter by type (default: all)"
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter news by category ID
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter news by date range (from)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter news by date range (to)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [relevance, date, views]
 *         description: "Sort order (default: relevance)"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: "Page number (default: 1)"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: "Results per page (default: 10)"
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 news:
 *                   type: array
 *                 categories:
 *                   type: array
 *                 transports:
 *                   type: array
 *                 meta:
 *                   type: object
 */
router.get("/", validate(searchValidators.search), asyncHandler(searchController.search));

export default router;
