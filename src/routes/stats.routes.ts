import { Router } from "express";
import { statsController } from "@/controllers/stats.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";

const router = Router();

/**
 * @openapi
 * /stats:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Get admin dashboard statistics
 *     description: Retrieve comprehensive statistics for the admin dashboard including user counts, news counts, ad counts, reports, and recent news activity. Only accessible by ADMIN and SUPER_ADMIN roles.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
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
 *                   example: "Admin stats retrieved"
 *                 data:
 *                   type: object
 *                   properties:
 *                     counts:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: number
 *                           example: 150
 *                         news:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: number
 *                               example: 1250
 *                             pending:
 *                               type: number
 *                               example: 12
 *                         ads:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: number
 *                               example: 89
 *                             active:
 *                               type: number
 *                               example: 45
 *                         reports:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: number
 *                               example: 23
 *                             pending:
 *                               type: number
 *                               example: 5
 *                     recentNews:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
// Only Admin/Super Admin
router.get("/", authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]), asyncHandler(statsController.getStats));

/**
 * @openapi
 * /stats/trends:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Get time-based trends
 *     description: Retrieve trends for news, users, and views over time (daily, weekly, or monthly). Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: Time period for trends
 *     responses:
 *       200:
 *         description: Trends retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/trends",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(statsController.getTrends)
);

/**
 * @openapi
 * /stats/news-popularity:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Get news popularity metrics
 *     description: Retrieve most viewed, trending, and recently popular news articles. Public endpoint.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results to return
 *     responses:
 *       200:
 *         description: News popularity retrieved successfully
 *       500:
 *         description: Internal server error
 */
// Public endpoint for news popularity (used in MostReadSidebar)
router.get("/news-popularity", asyncHandler(statsController.getNewsPopularity));

/**
 * @openapi
 * /stats/user-engagement:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Get user engagement metrics
 *     description: Retrieve user registration and activity metrics. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User engagement metrics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/user-engagement",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(statsController.getUserEngagement)
);

/**
 * @openapi
 * /stats/category-performance:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Get category performance metrics
 *     description: Retrieve performance metrics for all categories including news count, views, and average views. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category performance retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/category-performance",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(statsController.getCategoryPerformance)
);

/**
 * @openapi
 * /stats/conversion-metrics:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Get conversion metrics
 *     description: Retrieve conversion metrics including newsletter subscriptions, ad clicks/impressions, report submissions, and user registrations. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversion metrics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/conversion-metrics",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(statsController.getConversionMetrics)
);

/**
 * @openapi
 * /stats/export/{type}:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Export analytics data
 *     description: Export analytics data in CSV or JSON format. Supports audit logs, user behavior, news views, and ad analytics. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [audit-logs, user-behavior, news-views, ad-analytics]
 *         description: Type of data to export
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: csv
 *         description: Export format
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering (ISO 8601)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10000
 *         description: Maximum number of records to export
 *     responses:
 *       200:
 *         description: Export file generated successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/export/:type",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(statsController.exportData)
);

/**
 * @openapi
 * /stats/dashboard:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Get comprehensive analytics dashboard data
 *     description: Retrieve comprehensive dashboard data including overview stats, trends, top performers, recent activity, and hourly activity patterns. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
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
 *                     overview:
 *                       type: object
 *                     trends:
 *                       type: object
 *                     newsPopularity:
 *                       type: object
 *                     userEngagement:
 *                       type: object
 *                     categoryPerformance:
 *                       type: object
 *                     conversionMetrics:
 *                       type: object
 *                     topPerformers:
 *                       type: object
 *                     activity:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/dashboard",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(statsController.getDashboard)
);

export default router;
