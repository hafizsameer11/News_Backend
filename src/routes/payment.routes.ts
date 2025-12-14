import { Router } from "express";
import { paymentController } from "@/controllers/payment.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";

const router = Router();

// Webhook route (raw body is handled in app.ts before JSON parser)
router.post("/webhook", asyncHandler(paymentController.handleWebhook));

// Protected routes
router.post(
  "/plan/checkout",
  authGuard([ROLE.ADVERTISER]),
  asyncHandler(paymentController.createPlanCheckout)
);

router.post(
  "/ad/:adId",
  authGuard([ROLE.ADVERTISER, ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(paymentController.createAdPayment)
);

router.get(
  "/transactions",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(paymentController.getAllTransactions)
);

router.get("/transactions/me", authGuard(), asyncHandler(paymentController.getUserTransactions));

router.post(
  "/plan/:transactionId/cancel",
  authGuard([ROLE.ADVERTISER]),
  asyncHandler(paymentController.cancelPlan)
);

router.post(
  "/plan/:transactionId/change",
  authGuard([ROLE.ADVERTISER]),
  asyncHandler(paymentController.changePlan)
);

export default router;
