import prisma from "@/config/prisma";
import { emailService } from "./email.service";
import { logger } from "@/utils/logger";

/**
 * Breaking News Service
 * Handles breaking news alerts to newsletter subscribers
 */
export class BreakingNewsService {
  /**
   * Send breaking news alert to all newsletter subscribers
   */
  async sendBreakingNewsAlert(newsId: string): Promise<{
    success: boolean;
    recipientCount: number;
    error?: string;
  }> {
    try {
      // Check if alert already sent for this news
      const existingAlert = await prisma.breakingNewsAlert.findUnique({
        where: { newsId },
      });

      if (existingAlert) {
        logger.info(`Breaking news alert already sent for news ${newsId}`);
        return {
          success: true,
          recipientCount: existingAlert.recipientCount,
        };
      }

      // Get news details
      const news = await prisma.news.findUnique({
        where: { id: newsId },
        include: {
          category: true,
        },
      });

      if (!news) {
        throw new Error(`News not found: ${newsId}`);
      }

      // Only send if news is published and marked as breaking
      if (news.status !== "PUBLISHED" || !news.isBreaking) {
        logger.warn(`News ${newsId} is not published or not marked as breaking, skipping alert`);
        return {
          success: false,
          recipientCount: 0,
          error: "News is not published or not marked as breaking",
        };
      }

      // Get all active newsletter subscribers
      const subscribers = await prisma.newsletter.findMany({
        where: { isActive: true },
        select: { email: true },
      });

      if (subscribers.length === 0) {
        logger.info("No active newsletter subscribers to send breaking news alert to");
        return {
          success: true,
          recipientCount: 0,
        };
      }

      logger.info(
        `Sending breaking news alert for "${news.title}" to ${subscribers.length} subscriber(s)`
      );

      // Queue emails for all subscribers (non-blocking)
      let queuedCount = 0;
      for (const subscriber of subscribers) {
        try {
          // Queue email via email service (which will use the template)
          await emailService.sendBreakingNewsAlert(subscriber.email, {
            id: news.id,
            title: news.title,
            summary: news.summary,
            mainImage: news.mainImage || undefined,
            slug: news.slug,
          });
          queuedCount++;
        } catch (error) {
          logger.error(`Failed to queue breaking news email for ${subscriber.email}:`, error);
          // Continue with other subscribers
        }
      }

      // Record alert in database
      await prisma.breakingNewsAlert.create({
        data: {
          newsId: news.id,
          recipientCount: queuedCount,
        },
      });

      logger.info(
        `Breaking news alert queued for ${queuedCount}/${subscribers.length} subscriber(s)`
      );

      return {
        success: true,
        recipientCount: queuedCount,
      };
    } catch (error: any) {
      logger.error("Failed to send breaking news alert:", error);
      return {
        success: false,
        recipientCount: 0,
        error: error.message || "Unknown error",
      };
    }
  }

  /**
   * Get recent breaking news (for checking missed alerts)
   */
  async getRecentBreakingNews(hours: number = 1): Promise<any[]> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const breakingNews = await prisma.news.findMany({
      where: {
        isBreaking: true,
        status: "PUBLISHED",
        publishedAt: {
          gte: cutoffTime,
        },
      },
      include: {
        breakingNewsAlerts: true,
      },
      orderBy: { publishedAt: "desc" },
    });

    return breakingNews;
  }
}

// Export singleton instance
export const breakingNewsService = new BreakingNewsService();
