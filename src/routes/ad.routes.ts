import { Router } from "express";
import { adController } from "@/controllers/ad.controller";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard, optionalAuth } from "@/middleware/authGuard";
import {
  createAdValidator,
  updateAdValidator,
  approveAdValidator,
  rejectAdValidator,
} from "@/validators/ad.validators";
import { ROLE } from "@/types/enums";

const router = Router();

/**
 * @openapi
 * /ads:
 *   get:
 *     tags:
 *       - Ads
 *     summary: Get ads (Public/Advertiser/Admin)
 *     description: Retrieve ads with filtering. Public users see only ACTIVE ads. Advertisers see their own ads. Admins see all ads. Supports slot-based retrieval with weighted rotation.
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
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACTIVE, PAUSED, EXPIRED, REJECTED]
 *         description: Filter by status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [BANNER_TOP, BANNER_SIDE, INLINE, FOOTER, SLIDER, TICKER, POPUP, STICKY]
 *         description: Filter by ad type
 *       - in: query
 *         name: slot
 *         schema:
 *           type: string
 *         description: Get ads for specific slot (HEADER, SIDEBAR, etc.) - uses weighted random rotation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ads retrieved successfully
 *       401:
 *         description: Unauthorized
 */
// GET /ads - Public endpoint but extracts user if token is provided
// This allows admins to see all ads while public users see only active ads
router.get("/", optionalAuth(), asyncHandler(adController.getAll));

/**
 * @openapi
 * /ads/{id}/impression:
 *   post:
 *     tags:
 *       - Ads
 *     summary: Track ad impression
 *     description: Increment impression counter for an ad (public endpoint)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Impression tracked
 */
router.post("/:id/impression", asyncHandler(adController.trackImpression));

/**
 * @openapi
 * /ads/{id}/click:
 *   post:
 *     tags:
 *       - Ads
 *     summary: Track ad click
 *     description: Increment click counter for an ad (public endpoint)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Click tracked
 */
router.post("/:id/click", asyncHandler(adController.trackClick));

// Protected Routes (Advertiser & Admin)
router.use(authGuard([ROLE.ADVERTISER, ROLE.ADMIN, ROLE.SUPER_ADMIN]));

/**
 * @openapi
 * /ads:
 *   post:
 *     tags:
 *       - Ads
 *     summary: Create ad
 *     description: Create a new ad campaign. Price is automatically calculated based on type and duration.
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
 *               - type
 *               - imageUrl
 *               - targetLink
 *               - startDate
 *               - endDate
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *               type:
 *                 type: string
 *                 enum: [BANNER_TOP, BANNER_SIDE, INLINE, FOOTER, SLIDER, TICKER, POPUP, STICKY]
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               targetLink:
 *                 type: string
 *                 format: uri
 *               position:
 *                 type: string
 *                 optional: true
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               price:
 *                 type: number
 *                 optional: true
 *     responses:
 *       201:
 *         description: Ad created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", validate(createAdValidator), asyncHandler(adController.create));

/**
 * @openapi
 * /ads/{id}:
 *   patch:
 *     tags:
 *       - Ads
 *     summary: Update ad
 *     description: Update an existing ad. Advertisers can only update their own ads.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               targetLink:
 *                 type: string
 *                 format: uri
 *               position:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [PENDING, ACTIVE, PAUSED, EXPIRED, REJECTED]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Ad updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not ad owner
 */
router.patch("/:id", validate(updateAdValidator), asyncHandler(adController.update));

/**
 * @openapi
 * /ads/{id}:
 *   delete:
 *     tags:
 *       - Ads
 *     summary: Delete ad
 *     description: Delete an ad. Advertisers can only delete their own ads. Cannot delete ads with active transactions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ad deleted successfully
 *       400:
 *         description: Cannot delete ad with active transactions
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not ad owner
 */
router.delete("/:id", asyncHandler(adController.delete));

/**
 * @openapi
 * /ads/{id}/pay:
 *   post:
 *     tags:
 *       - Ads
 *     summary: Create payment intent for ad
 *     description: Create a Stripe payment intent for ad payment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment intent created
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
 *                     clientSecret:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *       400:
 *         description: Ad already paid or not found
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/pay", asyncHandler(adController.createPayment));

/**
 * @openapi
 * /ads/{id}/pause:
 *   post:
 *     tags:
 *       - Ads
 *     summary: Pause ad
 *     description: "Pause an active ad (status: ACTIVE → PAUSED)"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ad paused successfully
 *       400:
 *         description: Only ACTIVE ads can be paused
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/pause", asyncHandler(adController.pause));

/**
 * @openapi
 * /ads/{id}/resume:
 *   post:
 *     tags:
 *       - Ads
 *     summary: Resume ad
 *     description: "Resume a paused ad (status: PAUSED → ACTIVE). Validates date range before resuming."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ad resumed successfully
 *       400:
 *         description: Only PAUSED ads can be resumed or ad has expired
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/resume", asyncHandler(adController.resume));

/**
 * @openapi
 * /ads/{id}/analytics:
 *   get:
 *     tags:
 *       - Ads
 *     summary: Get ad analytics
 *     description: Get analytics for a specific ad (impressions, clicks, CTR). Advertisers can only see their own ads.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
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
 *                     adId:
 *                       type: string
 *                     title:
 *                       type: string
 *                     impressions:
 *                       type: number
 *                     clicks:
 *                       type: number
 *                     ctr:
 *                       type: number
 *                     status:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not ad owner
 */
router.get("/:id/analytics", asyncHandler(adController.getAnalytics));

/**
 * @openapi
 * /ads/analytics/me:
 *   get:
 *     tags:
 *       - Ads
 *     summary: Get advertiser analytics
 *     description: Get aggregated analytics for all ads belonging to the authenticated advertiser
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
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
 *                     totalAds:
 *                       type: number
 *                     totalImpressions:
 *                       type: number
 *                     totalClicks:
 *                       type: number
 *                     totalCtr:
 *                       type: number
 *                     ads:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized
 */
router.get("/analytics/me", asyncHandler(adController.getAdvertiserAnalytics));

/**
 * @openapi
 * /ads/{id}/approve:
 *   post:
 *     tags:
 *       - Ads
 *     summary: Approve ad (Admin only)
 *     description: "Approve a pending ad (status: PENDING → ACTIVE). Ad must be paid before approval."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ad approved successfully
 *       400:
 *         description: Only PENDING ads can be approved or ad must be paid first
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  "/:id/approve",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  validate(approveAdValidator),
  asyncHandler(adController.approve)
);

/**
 * @openapi
 * /ads/{id}/reject:
 *   post:
 *     tags:
 *       - Ads
 *     summary: Reject ad (Admin only)
 *     description: "Reject a pending ad with a reason (status: PENDING → REJECTED)"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Ad rejected successfully
 *       400:
 *         description: Only PENDING ads can be rejected
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  "/:id/reject",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  validate(rejectAdValidator),
  asyncHandler(adController.reject)
);

/**
 * @openapi
 * /ads/calendar:
 *   get:
 *     tags:
 *       - Ads
 *     summary: Get ad calendar (booked dates)
 *     description: Get calendar data showing which dates have ads booked. Returns dates with their booked positions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Year (optional, defaults to current year)
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 11
 *         description: Month (0-11, optional, defaults to current month)
 *     responses:
 *       200:
 *         description: Calendar data retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/calendar", authGuard([ROLE.ADMIN, ROLE.ADVERTISER, ROLE.SUPER_ADMIN]), asyncHandler(adController.getCalendar));

/**
 * @openapi
 * /ads/check-conflict:
 *   post:
 *     tags:
 *       - Ads
 *     summary: Check booking conflict
 *     description: Check if a date range + position combination is already booked
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               position:
 *                 type: string
 *                 nullable: true
 *               excludeAdId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Conflict check completed
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post("/check-conflict", authGuard([ROLE.ADMIN, ROLE.ADVERTISER, ROLE.SUPER_ADMIN]), asyncHandler(adController.checkConflict));

export default router;
