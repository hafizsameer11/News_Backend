import prisma from "@/config/prisma";
import { logger } from "@/utils/logger";

export interface UserBehaviorEventData {
  eventType: string;
  eventData?: any;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class UserBehaviorService {
  /**
   * Track user behavior event
   */
  async trackEvent(data: UserBehaviorEventData) {
    try {
      await prisma.userBehaviorEvent.create({
        data: {
          eventType: data.eventType,
          eventData: data.eventData ? JSON.stringify(data.eventData) : null,
          userId: data.userId || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
        },
      });
    } catch (error) {
      // Log error but don't break the request flow
      logger.error("Failed to track user behavior event:", error);
      throw error;
    }
  }

  /**
   * Track page view
   */
  async trackPageView(
    page: string,
    options?: { userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.trackEvent({
      eventType: "PAGE_VIEW",
      eventData: { page },
      userId: options?.userId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });
  }

  /**
   * Track search query
   */
  async trackSearch(
    query: string,
    resultsCount?: number,
    options?: { userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.trackEvent({
      eventType: "SEARCH",
      eventData: { query, resultsCount },
      userId: options?.userId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });
  }

  /**
   * Track click event
   */
  async trackClick(
    target: string,
    targetId?: string,
    options?: { userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.trackEvent({
      eventType: "CLICK",
      eventData: { target, targetId },
      userId: options?.userId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });
  }

  /**
   * Track newsletter subscription
   */
  async trackNewsletterSubscribe(
    email: string,
    options?: { userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.trackEvent({
      eventType: "NEWSLETTER_SUBSCRIBE",
      eventData: { email },
      userId: options?.userId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });
  }

  /**
   * Track report submission
   */
  async trackReportSubmit(
    reportId: string,
    options?: { userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.trackEvent({
      eventType: "REPORT_SUBMIT",
      eventData: { reportId },
      userId: options?.userId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });
  }

  /**
   * Get user behavior events with filters
   */
  async getEvents(filters?: {
    userId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.eventType) {
      where.eventType = filters.eventType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    return prisma.userBehaviorEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 100,
    });
  }
}
