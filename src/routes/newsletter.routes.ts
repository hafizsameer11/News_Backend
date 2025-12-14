import { Router } from "express";
import { newsletterController } from "@/controllers/newsletter.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import { validate } from "@/middleware/validate";
import { z } from "zod";

const router = Router();

const emailValidator = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const sendNewsletterValidator = z.object({
  body: z.object({
    subject: z.string().min(1, "Subject is required"),
    html: z.string().min(1, "HTML content is required"),
    text: z.string().optional(),
  }),
});

const updateStatusValidator = z.object({
  params: z.object({
    id: z.string().uuid("Invalid subscriber ID"),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

const deleteSubscriberValidator = z.object({
  params: z.object({
    id: z.string().uuid("Invalid subscriber ID"),
  }),
});

// Public
router.post("/subscribe", validate(emailValidator), asyncHandler(newsletterController.subscribe));

router.post(
  "/unsubscribe",
  validate(emailValidator),
  asyncHandler(newsletterController.unsubscribe)
);

// Admin
router.get(
  "/",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(newsletterController.getAll)
);

/**
 * @openapi
 * /newsletter/send:
 *   post:
 *     tags: [Newsletter]
 *     summary: Send newsletter to all subscribers (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - html
 *             properties:
 *               subject:
 *                 type: string
 *               html:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Newsletter queued for sending
 */
router.post(
  "/send",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  validate(sendNewsletterValidator),
  asyncHandler(newsletterController.send)
);

/**
 * @openapi
 * /newsletter/{id}/status:
 *   patch:
 *     tags: [Newsletter]
 *     summary: Update subscriber status (Admin only)
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
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Subscriber status updated
 */
router.patch(
  "/:id/status",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  validate(updateStatusValidator),
  asyncHandler(newsletterController.updateStatus)
);

/**
 * @openapi
 * /newsletter/{id}:
 *   delete:
 *     tags: [Newsletter]
 *     summary: Delete subscriber (Admin only)
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
 *         description: Subscriber deleted
 */
router.delete(
  "/:id",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  validate(deleteSubscriberValidator),
  asyncHandler(newsletterController.delete)
);

export default router;
