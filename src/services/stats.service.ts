import prisma from "@/config/prisma";
import { NEWS_STATUS } from "@/types/enums";

export class StatsService {
  async getAdminStats() {
    const [totalUsers, totalNews, pendingNews, totalAds, activeAds, totalReports, pendingReports] =
      await Promise.all([
        prisma.user.count(),
        prisma.news.count(),
        prisma.news.count({ where: { status: NEWS_STATUS.PENDING_REVIEW } }),
        prisma.ad.count(),
        prisma.ad.count({ where: { status: "ACTIVE" } }),
        prisma.report.count(),
        prisma.report.count({ where: { isResolved: false } }),
      ]);

    // Get recent activity (e.g. last 5 news)
    const recentNews = await prisma.news.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
    });

    return {
      counts: {
        users: totalUsers,
        news: {
          total: totalNews,
          pending: pendingNews,
        },
        ads: {
          total: totalAds,
          active: activeAds,
        },
        reports: {
          total: totalReports,
          pending: pendingReports,
        },
      },
      recentNews,
    };
  }

  /**
   * Get time-based trends (daily, weekly, monthly)
   */
  async getTrends(period: "daily" | "weekly" | "monthly" = "daily") {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "daily":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000); // Last 4 weeks
        break;
      case "monthly":
        startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000); // Last 12 months
        break;
    }

    const [newsTrends, userTrends, viewTrends, revenueTrends] = await Promise.all([
      // News created trends
      prisma.news.groupBy({
        by: ["createdAt"],
        where: {
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // User registration trends
      prisma.user.groupBy({
        by: ["createdAt"],
        where: {
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // News view trends (from view logs)
      prisma.newsViewLog.groupBy({
        by: ["viewedAt"],
        where: {
          viewedAt: { gte: startDate },
        },
        _count: true,
      }),

      // Revenue trends from transactions
      prisma.transaction.groupBy({
        by: ["createdAt"],
        where: {
          status: "SUCCEEDED",
          createdAt: { gte: startDate },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      period,
      startDate,
      trends: {
        news: newsTrends,
        users: userTrends,
        views: viewTrends,
        revenue: revenueTrends,
      },
    };
  }

  /**
   * Get news popularity metrics
   */
  async getNewsPopularity(limit: number = 10) {
    const [mostViewed, trending, recentPopular] = await Promise.all([
      // Most viewed news (all time)
      prisma.news.findMany({
        take: limit,
        orderBy: { views: "desc" },
        where: { status: NEWS_STATUS.PUBLISHED },
        include: {
          category: { select: { nameEn: true, nameIt: true } },
          author: { select: { name: true } },
        },
      }),

      // Trending news (most views in last 7 days)
      prisma.news.findMany({
        take: limit,
        where: {
          status: NEWS_STATUS.PUBLISHED,
          viewLogs: {
            some: {
              viewedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
        include: {
          category: { select: { nameEn: true, nameIt: true } },
          author: { select: { name: true } },
          _count: {
            select: {
              viewLogs: {
                where: {
                  viewedAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  },
                },
              },
            },
          },
        },
        orderBy: {
          viewLogs: {
            _count: "desc",
          },
        },
      }),

      // Recent popular (published in last 30 days, sorted by views)
      prisma.news.findMany({
        take: limit,
        where: {
          status: NEWS_STATUS.PUBLISHED,
          publishedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { views: "desc" },
        include: {
          category: { select: { nameEn: true, nameIt: true } },
          author: { select: { name: true } },
        },
      }),
    ]);

    return {
      mostViewed,
      trending,
      recentPopular,
    };
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers24h,
      newUsers7d,
      newUsers30d,
      activeUsers24h,
      activeUsers7d,
      totalBehaviorEvents,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: last24Hours } } }),
      prisma.user.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.user.count({ where: { createdAt: { gte: last30Days } } }),
      // Active users (users who have behavior events in last 24h)
      prisma.userBehaviorEvent
        .findMany({
          where: { createdAt: { gte: last24Hours } },
          distinct: ["userId"],
          select: { userId: true },
        })
        .then((events) => events.filter((e) => e.userId).length),
      // Active users (last 7 days)
      prisma.userBehaviorEvent
        .findMany({
          where: { createdAt: { gte: last7Days } },
          distinct: ["userId"],
          select: { userId: true },
        })
        .then((events) => events.filter((e) => e.userId).length),
      prisma.userBehaviorEvent.count(),
    ]);

    return {
      totalUsers,
      newUsers: {
        last24Hours: newUsers24h,
        last7Days: newUsers7d,
        last30Days: newUsers30d,
      },
      activeUsers: {
        last24Hours: activeUsers24h,
        last7Days: activeUsers7d,
      },
      totalBehaviorEvents,
    };
  }

  /**
   * Get category performance metrics
   */
  async getCategoryPerformance() {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            news: {
              where: { status: NEWS_STATUS.PUBLISHED },
            },
          },
        },
        news: {
          where: { status: NEWS_STATUS.PUBLISHED },
          select: {
            views: true,
            id: true,
          },
          take: 100, // Limit for performance
        },
      },
    });

    const categoryStats = categories.map((category) => {
      const totalViews = category.news.reduce((sum, news) => sum + news.views, 0);
      const avgViews = category.news.length > 0 ? totalViews / category.news.length : 0;

      return {
        id: category.id,
        nameEn: category.nameEn,
        nameIt: category.nameIt,
        slug: category.slug,
        newsCount: category._count.news,
        totalViews,
        avgViews: Math.round(avgViews),
      };
    });

    // Sort by total views descending
    categoryStats.sort((a, b) => b.totalViews - a.totalViews);

    return categoryStats;
  }

  /**
   * Get conversion metrics
   */
  async getConversionMetrics() {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [newsletterSubscriptions, adClicks, adImpressions, reportSubmissions, userRegistrations] =
      await Promise.all([
        prisma.newsletter.count({
          where: { subscribedAt: { gte: last30Days } },
        }),
        prisma.ad.aggregate({
          _sum: { clicks: true },
          where: {
            createdAt: { gte: last30Days },
          },
        }),
        prisma.ad.aggregate({
          _sum: { impressions: true },
          where: {
            createdAt: { gte: last30Days },
          },
        }),
        prisma.report.count({
          where: { createdAt: { gte: last30Days } },
        }),
        prisma.user.count({
          where: { createdAt: { gte: last30Days } },
        }),
      ]);

    const totalAdClicks = adClicks._sum.clicks || 0;
    const totalAdImpressions = adImpressions._sum.impressions || 0;
    const adCTR = totalAdImpressions > 0 ? (totalAdClicks / totalAdImpressions) * 100 : 0;

    return {
      period: "last30Days",
      metrics: {
        newsletterSubscriptions,
        adClicks: totalAdClicks,
        adImpressions: totalAdImpressions,
        adCTR: Math.round(adCTR * 100) / 100, // Round to 2 decimal places
        reportSubmissions,
        userRegistrations,
      },
    };
  }
}
