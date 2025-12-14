import prisma from "@/config/prisma";
import { emailService } from "./email.service";
import { emailQueueService } from "./email-queue.service";
import { logger } from "@/utils/logger";

export class NewsletterService {
  /**
   * Subscribe email
   */
  async subscribe(email: string) {
    const existing = await prisma.newsletter.findUnique({
      where: { email },
    });

    let subscriber;
    let isNewSubscription = false;

    if (existing) {
      if (!existing.isActive) {
        // Reactivate if previously unsubscribed
        subscriber = await prisma.newsletter.update({
          where: { email },
          data: { isActive: true },
        });
        isNewSubscription = true; // Treat reactivation as new subscription for welcome email
      } else {
        return existing; // Already subscribed
      }
    } else {
      subscriber = await prisma.newsletter.create({
        data: { email },
      });
      isNewSubscription = true;
    }

    // Send welcome email for new subscriptions (non-blocking)
    if (isNewSubscription) {
      try {
        await emailService.sendNewsletterWelcomeEmail(email);
      } catch (error) {
        // Log error but don't fail the subscription
        logger.error("Failed to send newsletter welcome email:", error);
      }
    }

    return subscriber;
  }

  /**
   * Unsubscribe email
   */
  async unsubscribe(email: string) {
    const existing = await prisma.newsletter.findUnique({
      where: { email },
    });

    if (!existing) {
      throw new Error("Email not found");
    }

    return await prisma.newsletter.update({
      where: { email },
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
      },
    });
  }

  /**
   * Get all subscribers (Admin)
   * Returns all subscribers (active and inactive) for admin management
   */
  async getAllSubscribers(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [subscribers, total] = await Promise.all([
      prisma.newsletter.findMany({
        skip,
        take: limit,
        orderBy: { subscribedAt: "desc" },
      }),
      prisma.newsletter.count(),
    ]);

    return {
      subscribers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update subscriber status (activate/deactivate) by ID (Admin)
   */
  async updateSubscriberStatus(id: string, isActive: boolean) {
    const subscriber = await prisma.newsletter.findUnique({
      where: { id },
    });

    if (!subscriber) {
      throw new Error("Subscriber not found");
    }

    const updateData: any = { isActive };

    // Set unsubscribedAt when deactivating, clear it when reactivating
    if (isActive === false) {
      updateData.unsubscribedAt = new Date();
    } else if (isActive === true) {
      updateData.unsubscribedAt = null;
    }

    return await prisma.newsletter.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete subscriber by ID (Admin)
   */
  async deleteSubscriber(id: string) {
    const subscriber = await prisma.newsletter.findUnique({
      where: { id },
    });

    if (!subscriber) {
      throw new Error("Subscriber not found");
    }

    await prisma.newsletter.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Send newsletter to all active subscribers
   */
  async sendNewsletterToSubscribers(
    subject: string,
    html: string,
    text?: string
  ): Promise<{
    success: boolean;
    queuedCount: number;
    totalSubscribers: number;
    error?: string;
  }> {
    try {
      // Get all active subscribers
      const subscribers = await prisma.newsletter.findMany({
        where: { isActive: true },
        select: { email: true },
      });

      if (subscribers.length === 0) {
        return {
          success: true,
          queuedCount: 0,
          totalSubscribers: 0,
        };
      }

      logger.info(`Sending newsletter "${subject}" to ${subscribers.length} subscriber(s)`);

      // Queue emails for all subscribers (non-blocking)
      let queuedCount = 0;
      for (const subscriber of subscribers) {
        try {
          await emailQueueService.enqueueEmail(subscriber.email, subject, html, text);
          queuedCount++;
        } catch (error) {
          logger.error(`Failed to queue newsletter email for ${subscriber.email}:`, error);
          // Continue with other subscribers
        }
      }

      logger.info(`Newsletter queued for ${queuedCount}/${subscribers.length} subscriber(s)`);

      return {
        success: true,
        queuedCount,
        totalSubscribers: subscribers.length,
      };
    } catch (error: any) {
      logger.error("Failed to send newsletter to subscribers:", error);
      return {
        success: false,
        queuedCount: 0,
        totalSubscribers: 0,
        error: error.message || "Unknown error",
      };
    }
  }

  /**
   * Send newsletter to single subscriber
   */
  async sendNewsletterToSubscriber(
    email: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<boolean> {
    try {
      await emailQueueService.enqueueEmail(email, subject, html, text);
      return true;
    } catch (error) {
      logger.error(`Failed to queue newsletter email for ${email}:`, error);
      return false;
    }
  }
}
