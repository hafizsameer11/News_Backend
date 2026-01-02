import { Router } from "express";
import { asyncHandler } from "@/middleware/asyncHandler";
import { successResponse } from "@/utils/response";
import prisma from "@/config/prisma";
import env from "@/config/env";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import categoryRoutes from "./category.routes";
import newsRoutes from "./news.routes";
import weatherRoutes from "./weather.routes";
import horoscopeRoutes from "./horoscope.routes";
import transportRoutes from "./transport.routes";
import mediaRoutes from "./media.routes";
import tgRoutes from "./tg.routes";
import adRoutes from "./ad.routes";
import videoUploadRoutes from "./video-upload.routes";
import newsletterRoutes from "./newsletter.routes";
import reportRoutes from "./report.routes";
import socialRoutes from "./social.routes";
import socialWebhookRoutes from "./social-webhook.routes";
import searchRoutes from "./search.routes";
import sitemapRoutes from "./sitemap.routes";
import structuredDataRoutes from "./structured-data.routes";
import seoRoutes from "./seo.routes";
import statsRoutes from "./stats.routes";
import analyticsRoutes from "./analytics.routes";
import paymentRoutes from "./payment.routes";
import chatRoutes from "./chat.routes";
import memoRoutes from "./memo.routes";
import homepageRoutes from "./homepage.routes";
import bookmarkRoutes from "./bookmark.routes";
import configRoutes from "./config.routes";
import { PasswordService } from "@/services/password.service";
import { validate } from "@/middleware/validate";
import { forgotPasswordValidator, resetPasswordValidator } from "@/validators/password.validators";

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - System
 *     summary: Check server health
 *     description: Returns the health status, timestamp, and uptime of the server.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                     uptime:
 *                       type: number
 */
router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const health: {
      status: string;
      timestamp: string;
      uptime: number;
      database: { status: string; error?: string };
      redis?: { status: string; error?: string };
    } = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: { status: "unknown" },
    };

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.database = { status: "connected" };
    } catch (error: any) {
      health.database = { status: "disconnected", error: error.message };
      health.status = "degraded";
    }

    // Check Redis connection if enabled
    if (env.REDIS_ENABLED) {
      try {
        const { redisClient } = await import("@/lib/redis-client");
        const status = redisClient.getConnectionStatus();
        if (status.connected) {
          health.redis = { status: "connected" };
        } else {
          health.redis = { status: "disconnected", error: "Redis client not connected" };
          health.status = "degraded";
        }
      } catch (error: any) {
        health.redis = { status: "disconnected", error: error.message };
        health.status = "degraded";
      }
    }

    const statusCode = health.status === "healthy" ? 200 : 503;
    return successResponse(res, `Server is ${health.status}`, health, statusCode);
  })
);

// Auth Routes
router.use("/auth", authRoutes);

// Password Reset Routes
const passwordService = new PasswordService();

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset link sent (if email exists)
 */
router.post(
  "/auth/forgot-password",
  validate(forgotPasswordValidator),
  asyncHandler(async (req, res) => {
    const result = await passwordService.forgotPassword(req.body.email);
    return successResponse(res, "Reset link sent", result);
  })
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post(
  "/auth/reset-password",
  validate(resetPasswordValidator),
  asyncHandler(async (req, res) => {
    const result = await passwordService.resetPassword(req.body.token, req.body.password);
    return successResponse(res, "Password reset successfully", result);
  })
);

// User Management Routes
router.use("/users", userRoutes);

// Content Management Routes
router.use("/categories", categoryRoutes);
router.use("/news", newsRoutes);
router.use("/media", mediaRoutes);
router.use("/tg", tgRoutes);
router.use("/video", videoUploadRoutes);

// Regional Modules
router.use("/weather", weatherRoutes);
router.use("/horoscope", horoscopeRoutes);
router.use("/transport", transportRoutes);

// Commercial Modules
router.use("/ads", adRoutes);

// Engagement & System
router.use("/newsletter", newsletterRoutes);
router.use("/reports", reportRoutes);
router.use("/social", socialRoutes);
router.use("/social/webhook", socialWebhookRoutes); // Webhooks (no auth required)
router.use("/search", searchRoutes);
router.use("/sitemap", sitemapRoutes); // Sitemap (no auth required)
router.use("/seo", structuredDataRoutes); // Structured data (no auth required)
router.use("/seo", seoRoutes); // SEO metadata (no auth required)
router.use("/stats", statsRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/payment", paymentRoutes);
router.use("/chat", chatRoutes);
router.use("/memo", memoRoutes);
router.use("/homepage", homepageRoutes);
router.use("/bookmarks", bookmarkRoutes);
router.use("/config", configRoutes); // Public config (no auth required)

export default router;
