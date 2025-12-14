import { Response } from "express";
import { PaymentService } from "@/services/payment.service";
import { successResponse } from "@/utils/response";
import { AuthenticatedRequest } from "@/types/global.types";

const paymentService = new PaymentService();

export const paymentController = {
  createPlanCheckout: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const { planId, planPrice } = req.body;

    if (!planId || !planPrice) {
      throw new Error("Plan ID and price are required");
    }

    const result = await paymentService.createPlanCheckoutSession(
      req.user.id,
      planId,
      Number(planPrice)
    );
    return successResponse(res, "Checkout session created", result);
  },

  createAdPayment: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await paymentService.createAdPaymentIntent(req.params.adId, req.user.id);
    return successResponse(res, "Payment intent created", result);
  },

  handleWebhook: async (req: any, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(400).send("Webhook secret not configured");
    }

    let event;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Stripe = require("stripe");
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("Stripe secret key not configured");
      }
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      // req.body is already raw buffer from express.raw() middleware in app.ts
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    await paymentService.handleWebhook(event);
    return res.json({ received: true });
  },

  getAllTransactions: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await paymentService.getAllTransactions(req.query, req.user.role);
    return successResponse(res, "Transactions retrieved", result);
  },

  getUserTransactions: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const result = await paymentService.getUserTransactions(req.user.id);
    return successResponse(res, "User transactions retrieved", result);
  },

  cancelPlan: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const { transactionId } = req.params;

    if (!transactionId) {
      throw new Error("Transaction ID is required");
    }

    const result = await paymentService.cancelPlan(req.user.id, transactionId);
    return successResponse(res, result.message, result);
  },

  changePlan: async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new Error("Unauthorized");
    const { transactionId } = req.params;
    const { newPlanId, newPlanPrice } = req.body;

    if (!transactionId) {
      throw new Error("Transaction ID is required");
    }

    if (!newPlanId || !newPlanPrice) {
      throw new Error("New plan ID and price are required");
    }

    const result = await paymentService.changePlan(
      req.user.id,
      transactionId,
      newPlanId,
      Number(newPlanPrice)
    );
    return successResponse(res, result.message, result);
  },
};
