import { Router } from "express";
import { SocialService } from "@/services/social.service";
import { successResponse } from "@/utils/response";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE, PLATFORM } from "@/types/enums";
import { validate } from "@/middleware/validate";
import { connectAccountValidator, postToSocialValidator } from "@/validators/social.validators";

const router = Router();
const socialService = new SocialService();

// Admin only
router.use(authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]));

/**
 * @openapi
 * /social:
 *   get:
 *     tags:
 *       - Social Media
 *     summary: Get connected social accounts
 *     description: Retrieve all active connected social media accounts (Facebook/Instagram)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of connected accounts
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
 *                   example: "Connected accounts"
 *                 data:
 *                   type: object
 *                   properties:
 *                     accounts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           platform:
 *                             type: string
 *                             enum: [FACEBOOK, INSTAGRAM]
 *                           accountId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           isActive:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await socialService.getAccounts();
    return successResponse(res, "Connected accounts", { accounts: result });
  })
);

/**
 * @openapi
 * /social/connect:
 *   post:
 *     tags:
 *       - Social Media
 *     summary: Connect social account (manual token entry)
 *     description: Manually connect a social media account by providing access token. For OAuth flow, use /social/oauth/{platform}/authorize
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - token
 *               - accountId
 *               - name
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [FACEBOOK, INSTAGRAM]
 *               token:
 *                 type: string
 *                 description: Access token from Facebook/Instagram
 *               accountId:
 *                 type: string
 *                 description: External account ID (page ID for Facebook, account ID for Instagram)
 *               name:
 *                 type: string
 *                 description: Account name (page name or username)
 *     responses:
 *       200:
 *         description: Account connected successfully
 *       400:
 *         description: Validation error
 */
router.post(
  "/connect",
  validate(connectAccountValidator),
  asyncHandler(async (req, res) => {
    const { platform, token, accountId, name } = req.body;
    const result = await socialService.connectAccount(platform, token, accountId, name);
    return successResponse(res, "Account connected", { account: result });
  })
);

/**
 * @openapi
 * /social/{id}:
 *   delete:
 *     tags:
 *       - Social Media
 *     summary: Disconnect social account
 *     description: Disconnect and deactivate a social media account
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
 *         description: Account disconnected successfully
 *       404:
 *         description: Account not found
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await socialService.disconnectAccount(req.params.id);
    return successResponse(res, "Account disconnected");
  })
);

/**
 * @openapi
 * /social/post/{newsId}:
 *   post:
 *     tags:
 *       - Social Media
 *     summary: Post news article to social media
 *     description: Post a news article to connected Facebook and/or Instagram accounts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [FACEBOOK, INSTAGRAM]
 *                 description: Platforms to post to (defaults to both if not specified)
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *                 description: Optional scheduled posting time (not yet implemented)
 *     responses:
 *       200:
 *         description: Posting results
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       newsId:
 *                         type: string
 *                       platform:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [SUCCESS, FAILED]
 *                       message:
 *                         type: string
 *       404:
 *         description: News article not found
 */
router.post(
  "/post/:newsId",
  validate(postToSocialValidator),
  asyncHandler(async (req, res) => {
    const { platforms } = req.body; // Expect array of platforms
    const result = await socialService.postToSocial(
      req.params.newsId,
      platforms || [PLATFORM.FACEBOOK, PLATFORM.INSTAGRAM]
    );
    return successResponse(res, "Posted to social media", result);
  })
);

/**
 * @openapi
 * /social/oauth/facebook/authorize:
 *   get:
 *     tags:
 *       - Social Media
 *     summary: Initiate Facebook OAuth flow
 *     description: Redirects to Facebook OAuth authorization page. User must be authenticated.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       302:
 *         description: Redirect to Facebook OAuth
 */
// OAuth Routes
router.get(
  "/oauth/facebook/authorize",
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    const authUrl = socialService.initiateFacebookOAuth(userId);
    return res.redirect(authUrl);
  })
);

/**
 * @openapi
 * /social/oauth/facebook/callback:
 *   get:
 *     tags:
 *       - Social Media
 *     summary: Facebook OAuth callback
 *     description: Handles Facebook OAuth callback and redirects to admin settings page
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to admin settings page
 */
router.get(
  "/oauth/facebook/callback",
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(
        `${process.env.CORS_ORIGIN || "http://localhost:3000"}/admin/settings?error=${encodeURIComponent(error as string)}`
      );
    }

    if (!code) {
      return res.redirect(
        `${process.env.CORS_ORIGIN || "http://localhost:3000"}/admin/settings?error=missing_code`
      );
    }

    try {
      const account = await socialService.handleFacebookCallback(code as string, state as string);
      return res.redirect(
        `${process.env.CORS_ORIGIN || "http://localhost:3000"}/admin/settings?success=facebook_connected&account=${encodeURIComponent(account.name || "")}`
      );
    } catch (error: any) {
      return res.redirect(
        `${process.env.CORS_ORIGIN || "http://localhost:3000"}/admin/settings?error=${encodeURIComponent(error.message)}`
      );
    }
  })
);

/**
 * @openapi
 * /social/oauth/instagram/authorize:
 *   get:
 *     tags:
 *       - Social Media
 *     summary: Initiate Instagram OAuth flow
 *     description: Redirects to Instagram OAuth authorization page. User must be authenticated.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       302:
 *         description: Redirect to Instagram OAuth
 */
router.get(
  "/oauth/instagram/authorize",
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    const authUrl = socialService.initiateInstagramOAuth(userId);
    return res.redirect(authUrl);
  })
);

/**
 * @openapi
 * /social/oauth/instagram/callback:
 *   get:
 *     tags:
 *       - Social Media
 *     summary: Instagram OAuth callback
 *     description: Handles Instagram OAuth callback and redirects to admin settings page
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to admin settings page
 */
router.get(
  "/oauth/instagram/callback",
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(
        `${process.env.CORS_ORIGIN || "http://localhost:3000"}/admin/settings?error=${encodeURIComponent(error as string)}`
      );
    }

    if (!code) {
      return res.redirect(
        `${process.env.CORS_ORIGIN || "http://localhost:3000"}/admin/settings?error=missing_code`
      );
    }

    try {
      const account = await socialService.handleInstagramCallback(code as string, state as string);
      return res.redirect(
        `${process.env.CORS_ORIGIN || "http://localhost:3000"}/admin/settings?success=instagram_connected&account=${encodeURIComponent(account.name || "")}`
      );
    } catch (error: any) {
      return res.redirect(
        `${process.env.CORS_ORIGIN || "http://localhost:3000"}/admin/settings?error=${encodeURIComponent(error.message)}`
      );
    }
  })
);

export default router;
