import { Router } from "express";
import { configController } from "@/controllers/config.controller";
import { asyncHandler } from "@/middleware/asyncHandler";

const router = Router();

/**
 * @openapi
 * /config/public:
 *   get:
 *     tags:
 *       - Config
 *     summary: Get public configuration
 *     description: Returns public configuration settings that the frontend needs (e.g., email verification enabled)
 *     responses:
 *       200:
 *         description: Public configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     enableEmailVerification:
 *                       type: boolean
 *                     frontendUrl:
 *                       type: string
 *                     siteName:
 *                       type: string
 */
router.get("/public", asyncHandler(configController.getPublicConfig));

export default router;
