import { Router } from "express";
import { asyncHandler } from "@/middleware/asyncHandler";
import { validate } from "@/middleware/validate";
import { trackEventValidator } from "@/validators/analytics.validators";
import { UserBehaviorService } from "@/services/user-behavior.service";
import { successResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";
import { Request, Response } from "express";

const router = Router();
const userBehaviorService = new UserBehaviorService();

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string | undefined {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    undefined
  );
}

/**
 * @openapi
 * /analytics/track:
 *   post:
 *     tags:
 *       - Analytics
 *     summary: Track user behavior event
 *     description: Public endpoint for frontend to send user behavior tracking events (page views, clicks, searches, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *             properties:
 *               eventType:
 *                 type: string
 *                 description: Type of event (PAGE_VIEW, SEARCH, CLICK, NEWSLETTER_SUBSCRIBE, REPORT_SUBMIT, etc.)
 *                 example: "PAGE_VIEW"
 *               eventData:
 *                 type: object
 *                 description: Event-specific data (optional)
 *                 example:
 *                   page: "/news/article-slug"
 *                   query: "calabria news"
 *     responses:
 *       200:
 *         description: Event tracked successfully
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
 *                   example: "Event tracked"
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post(
  "/track",
  validate(trackEventValidator),
  asyncHandler(async (req: Request | AuthenticatedRequest, res: Response) => {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || undefined;
    const userId = (req as AuthenticatedRequest).user?.id;

    await userBehaviorService.trackEvent({
      eventType: req.body.eventType,
      eventData: req.body.eventData,
      userId,
      ipAddress,
      userAgent,
    });

    return successResponse(res, "Event tracked");
  })
);

export default router;
