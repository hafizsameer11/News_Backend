import { Router, Request, Response } from "express";
import { asyncHandler } from "@/middleware/asyncHandler";
import { SocialWebhookService } from "@/services/social-webhook.service";
import env from "@/config/env";
import { logger } from "@/utils/logger";

const router = Router();
const webhookService = new SocialWebhookService();

/**
 * Facebook Webhook Verification (GET)
 * Facebook sends a GET request to verify the webhook
 */
router.get(
  "/facebook",
  asyncHandler(async (req: Request, res: Response) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    if (!mode || !token || !challenge) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const verifyToken = env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
    const result = webhookService.verifyFacebookWebhook(mode, token, challenge, verifyToken);

    if (result) {
      return res.status(200).send(result);
    }

    return res.status(403).json({ error: "Verification failed" });
  })
);

/**
 * Facebook Webhook Events (POST)
 * Facebook sends POST requests with webhook events
 */
router.post(
  "/facebook",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const event = req.body as any;

      // Verify webhook signature if configured
      // Note: Facebook webhook signature verification would go here
      // const signature = req.headers["x-hub-signature-256"] as string;
      // if (signature && !facebookClient.verifyWebhookSignature(JSON.stringify(req.body), signature)) {
      //   return res.status(403).json({ error: "Invalid signature" });
      // }

      // Process webhook asynchronously
      webhookService.processFacebookWebhook(event).catch((error) => {
        logger.error("Error processing Facebook webhook:", error);
      });

      // Return 200 immediately to acknowledge receipt
      return res.status(200).json({ received: true });
    } catch (error) {
      logger.error("Facebook webhook error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  })
);

/**
 * Instagram Webhook Verification (GET)
 */
router.get(
  "/instagram",
  asyncHandler(async (req: Request, res: Response) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    if (!mode || !token || !challenge) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const verifyToken = env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
    const result = webhookService.verifyInstagramWebhook(mode, token, challenge, verifyToken);

    if (result) {
      return res.status(200).send(result);
    }

    return res.status(403).json({ error: "Verification failed" });
  })
);

/**
 * Instagram Webhook Events (POST)
 */
router.post(
  "/instagram",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const event = req.body as any;

      // Verify webhook signature if configured
      // Note: Instagram webhook signature verification would go here

      // Process webhook asynchronously
      webhookService.processInstagramWebhook(event).catch((error) => {
        logger.error("Error processing Instagram webhook:", error);
      });

      // Return 200 immediately to acknowledge receipt
      return res.status(200).json({ received: true });
    } catch (error) {
      logger.error("Instagram webhook error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  })
);

export default router;
