import prisma from "@/config/prisma";
import env from "@/config/env";
import Stripe from "stripe";
import { ROLE } from "@/types/enums";

// Initialize Stripe (lazy initialization to handle missing key)
let stripeInstance: Stripe | null = null;

const getStripe = () => {
  if (!stripeInstance) {
    // Check both env object and process.env directly (in case .env wasn't loaded properly)
    const stripeKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

    if (!stripeKey || stripeKey === "sk_test_placeholder" || stripeKey.trim() === "") {
      console.error("❌ STRIPE_SECRET_KEY is not set or is placeholder");
      console.error(
        "   Current value from env:",
        env.STRIPE_SECRET_KEY ? `${env.STRIPE_SECRET_KEY.substring(0, 10)}...` : "undefined"
      );
      console.error(
        "   Current value from process.env:",
        process.env.STRIPE_SECRET_KEY
          ? `${process.env.STRIPE_SECRET_KEY.substring(0, 10)}...`
          : "undefined"
      );
      throw new Error(
        "Stripe secret key not configured. Please set STRIPE_SECRET_KEY in .env file"
      );
    }

    // Validate key format
    const trimmedKey = stripeKey.trim();
    if (!trimmedKey.startsWith("sk_test_") && !trimmedKey.startsWith("sk_live_")) {
      throw new Error("Invalid Stripe secret key format. Must start with 'sk_test_' or 'sk_live_'");
    }

    stripeInstance = new Stripe(trimmedKey, {
      apiVersion: "2024-09-30.acacia" as any,
    });
  }
  return stripeInstance;
};

export class PaymentService {
  /**
   * Create Checkout Session for Plan Subscription
   */
  async createPlanCheckoutSession(userId: string, planId: string, planPrice: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (user.role !== "ADVERTISER") throw new Error("Only advertisers can subscribe to plans");

    // Create or retrieve Stripe customer
    let customerId: string;
    let stripeCustomer;

    try {
      // Try to find existing customer
      const stripe = getStripe();
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomer = customers.data[0];
        customerId = stripeCustomer.id;
      } else {
        // Create new customer
        stripeCustomer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: user.id,
            companyName: user.companyName || "",
          },
        });
        customerId = stripeCustomer.id;
      }
    } catch (error: any) {
      console.error("Error creating/retrieving Stripe customer:", error);
      const errorMessage =
        error?.message || error?.raw?.message || "Failed to create Stripe customer";
      throw new Error(`Stripe error: ${errorMessage}`);
    }

    // Create checkout session
    let session;
    try {
      const stripe = getStripe();
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: `NEWS NEXT - ${planId.toUpperCase()} Plan`,
                description: `Monthly subscription for ${planId} plan`,
              },
              unit_amount: Math.round(planPrice * 100), // Convert to cents
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${env.CORS_ORIGIN}/advertiser/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.CORS_ORIGIN}/register/plans?payment=cancelled`,
        metadata: {
          userId: user.id,
          planId: planId,
          type: "plan_subscription",
        },
      });
    } catch (error: any) {
      console.error("Error creating Stripe checkout session:", error);
      throw new Error(error?.message || "Failed to create checkout session");
    }

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        planId: planId,
        amount: planPrice,
        currency: "EUR",
        status: "PENDING",
        stripePaymentIntentId: session.id,
        stripeCustomerId: customerId,
        description: `Plan subscription: ${planId}`,
        metadata: JSON.stringify({
          planId,
          sessionId: session.id,
        }),
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Create Payment Intent for Ad Payment
   */
  async createAdPaymentIntent(adId: string, userId: string) {
    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new Error("Ad not found");

    if (ad.advertiserId !== userId) throw new Error("Unauthorized");
    if (ad.isPaid) throw new Error("Ad is already paid");
    if (!ad.price) throw new Error("Ad price not set");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    // Create or retrieve Stripe customer
    let customerId: string;
    try {
      const stripe = getStripe();
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
      }
    } catch (error: any) {
      console.error("Error creating/retrieving Stripe customer:", error);
      const errorMessage =
        error?.message || error?.raw?.message || "Failed to create Stripe customer";
      throw new Error(`Stripe error: ${errorMessage}`);
    }

    // Create payment intent
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(ad.price) * 100), // Convert to cents
      currency: "eur",
      customer: customerId,
      metadata: {
        adId: ad.id,
        userId: userId,
        type: "ad_payment",
      },
    });

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        userId: userId,
        adId: ad.id,
        amount: ad.price,
        currency: "EUR",
        status: "PENDING",
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: customerId,
        description: `Payment for ad: ${ad.title}`,
        metadata: JSON.stringify({
          adId: ad.id,
          adTitle: ad.title,
        }),
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: ad.price,
      currency: "eur",
    };
  }

  /**
   * Handle Stripe Webhook
   */
  async handleWebhook(event: Stripe.Event) {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Find transaction by session ID
      const transaction = await prisma.transaction.findFirst({
        where: { stripePaymentIntentId: session.id },
      });

      if (transaction) {
        // Update transaction
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "SUCCEEDED",
            stripeChargeId: session.payment_intent as string,
            metadata: JSON.stringify({
              ...JSON.parse(transaction.metadata || "{}"),
              sessionId: session.id,
              completedAt: new Date().toISOString(),
            }),
          },
        });

        // If it's a plan subscription, update user metadata or create subscription record
        if (transaction.planId) {
          // Store plan info in user metadata or create subscription record
          await prisma.user.update({
            where: { id: transaction.userId },
            data: {
              // You might want to add a subscription field to User model
            },
          });
        }

        // If it's an ad payment, mark ad as paid
        if (transaction.adId) {
          await prisma.ad.update({
            where: { id: transaction.adId },
            data: {
              isPaid: true,
              status: "ACTIVE",
            },
          });
        }
      }
    } else if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      // Find transaction by payment intent ID
      const transaction = await prisma.transaction.findFirst({
        where: { stripePaymentIntentId: paymentIntent.id },
      });

      if (transaction) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "SUCCEEDED",
            stripeChargeId: paymentIntent.latest_charge as string,
          },
        });

        // Mark ad as paid if applicable
        if (transaction.adId) {
          await prisma.ad.update({
            where: { id: transaction.adId },
            data: {
              isPaid: true,
              status: "ACTIVE",
            },
          });
        }
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      const transaction = await prisma.transaction.findFirst({
        where: { stripePaymentIntentId: paymentIntent.id },
      });

      if (transaction) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "FAILED",
          },
        });
      }
    }
  }

  /**
   * Get all transactions (Admin only)
   */
  async getAllTransactions(query: any, role?: ROLE) {
    if (role !== ROLE.ADMIN && role !== ROLE.SUPER_ADMIN) {
      throw new Error("Unauthorized");
    }

    const { page = 1, limit = 20, status, userId } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              companyName: true,
            },
          },
          ad: {
            select: {
              id: true,
              title: true,
              type: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Get user transactions
   */
  async getUserTransactions(userId: string) {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        ad: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    });

    return transactions;
  }

  /**
   * Cancel Plan Subscription
   */
  async cancelPlan(userId: string, transactionId: string) {
    // Find the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Verify transaction belongs to user
    if (transaction.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Verify it's a plan transaction
    if (!transaction.planId) {
      throw new Error("This transaction is not for a plan subscription");
    }

    // Verify transaction is succeeded
    if (transaction.status !== "SUCCEEDED") {
      throw new Error("Only succeeded transactions can be cancelled");
    }

    // If there's a Stripe subscription, cancel it
    if (transaction.stripePaymentIntentId) {
      try {
        const stripe = getStripe();
        // Check if it's a checkout session (subscription)
        const session = await stripe.checkout.sessions.retrieve(transaction.stripePaymentIntentId);

        if (session.subscription) {
          // Cancel the subscription
          await stripe.subscriptions.cancel(session.subscription as string);
        }
      } catch (error: any) {
        console.error("Error canceling Stripe subscription:", error);
        // Continue with marking transaction as refunded even if Stripe cancellation fails
      }
    }

    // Mark transaction as refunded
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "REFUNDED",
        metadata: JSON.stringify({
          ...JSON.parse(transaction.metadata || "{}"),
          cancelledAt: new Date().toISOString(),
          cancelledBy: userId,
        }),
      },
    });

    return {
      message: "Plan cancelled successfully",
      transactionId: transaction.id,
    };
  }

  /**
   * Change Plan Subscription
   */
  async changePlan(userId: string, transactionId: string, newPlanId: string, newPlanPrice: number) {
    // Find the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Verify transaction belongs to user
    if (transaction.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Verify it's a plan transaction
    if (!transaction.planId) {
      throw new Error("This transaction is not for a plan subscription");
    }

    // Verify transaction is succeeded
    if (transaction.status !== "SUCCEEDED") {
      throw new Error("Only succeeded transactions can be changed");
    }

    // Verify new plan is different
    if (transaction.planId === newPlanId) {
      throw new Error("New plan must be different from current plan");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    // Create new checkout session for the new plan
    const checkoutResult = await this.createPlanCheckoutSession(userId, newPlanId, newPlanPrice);

    // Optionally cancel old subscription in Stripe
    if (transaction.stripePaymentIntentId) {
      try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(transaction.stripePaymentIntentId);

        if (session.subscription) {
          // Cancel the old subscription
          await stripe.subscriptions.cancel(session.subscription as string);
        }
      } catch (error: any) {
        console.error("Error canceling old Stripe subscription:", error);
        // Continue even if cancellation fails
      }
    }

    return {
      message: "Plan change initiated. Please complete the checkout for the new plan.",
      checkoutUrl: checkoutResult.url,
      sessionId: checkoutResult.sessionId,
    };
  }
}
