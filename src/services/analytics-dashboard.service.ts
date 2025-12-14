import prisma from "@/config/prisma";
import { StatsService } from "./stats.service";
import { NEWS_STATUS } from "@/types/enums";

export class AnalyticsDashboardService {
  private statsService: StatsService;

  constructor() {
    this.statsService = new StatsService();
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData() {
    // Get all metrics in parallel
    const [
      basicStats,
      trendsRaw,
      newsPopularity,
      userEngagement,
      categoryPerformance,
      conversionMetrics,
      topNews,
      topCategories,
      recentActivity,
      hourlyActivity,
      transactionRevenue,
    ] = await Promise.all([
      this.statsService.getAdminStats(),
      this.statsService.getTrends("daily"),
      this.statsService.getNewsPopularity(10),
      this.statsService.getUserEngagement(),
      this.statsService.getCategoryPerformance(),
      this.statsService.getConversionMetrics(),
      this.getTopNews(10),
      this.getTopCategories(10),
      this.getRecentActivity(),
      this.getHourlyActivity(),
      this.getTransactionRevenue("daily"),
    ]);

    // Transform trends data to frontend format
    const trends = this.transformTrendsData(trendsRaw, transactionRevenue);

    // Transform newsPopularity object to array format expected by frontend
    const newsPopularityArray = (newsPopularity.mostViewed || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      views: item.views || 0,
      slug: item.slug || item.id,
    }));

    // Transform userEngagement to match frontend expected format
    const userEngagementTransformed = {
      totalUsers: userEngagement.totalUsers || 0,
      activeUsers:
        userEngagement.activeUsers?.last7Days || userEngagement.activeUsers?.last24Hours || 0,
      newRegistrations:
        userEngagement.newUsers?.last7Days || userEngagement.newUsers?.last24Hours || 0,
      activeUsersPercentage:
        userEngagement.totalUsers > 0
          ? ((userEngagement.activeUsers?.last7Days || 0) / userEngagement.totalUsers) * 100
          : 0,
    };

    // Transform categoryPerformance to match frontend expected format
    const categoryPerformanceTransformed = categoryPerformance.map((item: any) => ({
      id: item.id,
      name: item.nameEn || item.name || "Unknown Category", // Use nameEn as default, fallback to name
      newsCount: item.newsCount || 0,
      views: item.totalViews || item.views || 0, // Map totalViews to views
    }));

    // Transform conversionMetrics to match frontend expected format
    const conversionMetricsTransformed = {
      newsletterSubscriptions: conversionMetrics.metrics?.newsletterSubscriptions || 0,
      adClicks: conversionMetrics.metrics?.adClicks || 0,
      adImpressions: conversionMetrics.metrics?.adImpressions || 0,
      clickThroughRate: conversionMetrics.metrics?.adCTR || 0,
    };

    return {
      overview: basicStats,
      trends,
      newsPopularity: newsPopularityArray,
      userEngagement: userEngagementTransformed,
      categoryPerformance: categoryPerformanceTransformed,
      conversionMetrics: conversionMetricsTransformed,
      topPerformers: {
        news: topNews.map((item: any) => ({
          id: item.id,
          title: item.title || "Untitled",
          slug: item.slug || item.id,
          views: item.views || 0,
        })),
        categories: topCategories.map((item: any) => ({
          id: item.id,
          name: item.nameEn || item.name || "Unknown Category",
          newsCount: item.newsCount || 0,
          views: item.totalViews || item.views || 0,
        })),
      },
      activity: {
        recent: this.transformRecentActivityToTimeline(recentActivity),
        hourly: hourlyActivity,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Transform trends data from backend format to frontend format
   */
  private transformTrendsData(trendsRaw: any, revenueData: any[]): { period: string; data: any[] } {
    const dateMap = new Map<
      string,
      { views: number; news: number; users: number; revenue: number }
    >();

    // Process view trends
    if (trendsRaw.trends?.views && Array.isArray(trendsRaw.trends.views)) {
      trendsRaw.trends.views.forEach((item: any) => {
        const date = new Date(item.viewedAt || item.createdAt).toISOString().split("T")[0];
        const existing = dateMap.get(date) || { views: 0, news: 0, users: 0, revenue: 0 };
        dateMap.set(date, { ...existing, views: item._count || 0 });
      });
    }

    // Process news trends
    if (trendsRaw.trends?.news && Array.isArray(trendsRaw.trends.news)) {
      trendsRaw.trends.news.forEach((item: any) => {
        const date = new Date(item.createdAt).toISOString().split("T")[0];
        const existing = dateMap.get(date) || { views: 0, news: 0, users: 0, revenue: 0 };
        dateMap.set(date, { ...existing, news: item._count || 0 });
      });
    }

    // Process user trends
    if (trendsRaw.trends?.users && Array.isArray(trendsRaw.trends.users)) {
      trendsRaw.trends.users.forEach((item: any) => {
        const date = new Date(item.createdAt).toISOString().split("T")[0];
        const existing = dateMap.get(date) || { views: 0, news: 0, users: 0, revenue: 0 };
        dateMap.set(date, { ...existing, users: item._count || 0 });
      });
    }

    // Add revenue data
    if (revenueData && Array.isArray(revenueData)) {
      revenueData.forEach((item: any) => {
        const date = new Date(item.date).toISOString().split("T")[0];
        const existing = dateMap.get(date) || { views: 0, news: 0, users: 0, revenue: 0 };
        dateMap.set(date, { ...existing, revenue: item.revenue || 0 });
      });
    }

    // Convert map to array and sort by date
    const trendData = Array.from(dateMap.entries())
      .map(([date, values]) => ({
        date,
        views: values.views,
        news: values.news,
        users: values.users,
        revenue: values.revenue,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      period: trendsRaw.period || "daily",
      data: trendData,
    };
  }

  /**
   * Get transaction revenue grouped by date
   */
  private async getTransactionRevenue(period: "daily" | "weekly" | "monthly" = "daily") {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "daily":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        status: "SUCCEEDED",
        createdAt: { gte: startDate },
      },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    // Group by date and sum amounts
    const revenueMap = new Map<string, number>();
    transactions.forEach((tx) => {
      const date = new Date(tx.createdAt).toISOString().split("T")[0];
      const amount = typeof tx.amount === "number" ? tx.amount : parseFloat(String(tx.amount)) || 0;
      revenueMap.set(date, (revenueMap.get(date) || 0) + amount);
    });

    return Array.from(revenueMap.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));
  }

  /**
   * Get top news by views
   */
  private async getTopNews(limit: number = 10) {
    return prisma.news.findMany({
      take: limit,
      where: { status: NEWS_STATUS.PUBLISHED },
      orderBy: { views: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        views: true,
        publishedAt: true,
        category: {
          select: {
            nameEn: true,
            nameIt: true,
          },
        },
        author: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get top categories by news count and views
   */
  private async getTopCategories(limit: number = 10) {
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
          },
          take: 100, // Limit for performance
        },
      },
    });

    const categoryStats = categories.map((category) => {
      const totalViews = category.news.reduce((sum, news) => sum + (news.views || 0), 0);
      return {
        id: category.id,
        nameEn: category.nameEn,
        nameIt: category.nameIt,
        slug: category.slug,
        newsCount: category._count.news,
        totalViews,
      };
    });

    // Sort by total views and return top N
    return categoryStats.sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0)).slice(0, limit);
  }

  /**
   * Get recent activity (last 24 hours)
   */
  private async getRecentActivity() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [newNews, newUsers, newReports, newAds] = await Promise.all([
      prisma.news.count({
        where: {
          createdAt: { gte: last24Hours },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: last24Hours },
        },
      }),
      prisma.report.count({
        where: {
          createdAt: { gte: last24Hours },
        },
      }),
      prisma.ad.count({
        where: {
          createdAt: { gte: last24Hours },
        },
      }),
    ]);

    return {
      last24Hours: {
        newNews,
        newUsers,
        newReports,
        newAds,
      },
    };
  }

  /**
   * Get hourly activity for the last 24 hours
   */
  private async getHourlyActivity() {
    const hours: { hour: number; views: number; events: number }[] = [];
    const now = new Date();

    // Get activity for each hour in the last 24 hours
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const [views, events] = await Promise.all([
        prisma.newsViewLog.count({
          where: {
            viewedAt: {
              gte: hourStart,
              lt: hourEnd,
            },
          },
        }),
        prisma.userBehaviorEvent.count({
          where: {
            createdAt: {
              gte: hourStart,
              lt: hourEnd,
            },
          },
        }),
      ]);

      hours.push({
        hour: hourStart.getHours(),
        views,
        events,
      });
    }

    return hours;
  }

  /**
   * Transform recent activity counts to timeline format
   */
  private transformRecentActivityToTimeline(activityData: any): any[] {
    const activities: any[] = [];
    const now = new Date();

    if (activityData?.last24Hours) {
      const { newNews, newUsers, newReports, newAds } = activityData.last24Hours;

      if (newNews > 0) {
        activities.push({
          id: `news-${now.getTime()}-1`,
          type: "NEWS_CREATED",
          description: `${newNews} new news article${newNews > 1 ? "s" : ""} published`,
          timestamp: now.toISOString(),
        });
      }

      if (newUsers > 0) {
        activities.push({
          id: `users-${now.getTime()}-2`,
          type: "USER_REGISTERED",
          description: `${newUsers} new user${newUsers > 1 ? "s" : ""} registered`,
          timestamp: now.toISOString(),
        });
      }

      if (newReports > 0) {
        activities.push({
          id: `reports-${now.getTime()}-3`,
          type: "REPORT_SUBMITTED",
          description: `${newReports} new report${newReports > 1 ? "s" : ""} submitted`,
          timestamp: now.toISOString(),
        });
      }

      if (newAds > 0) {
        activities.push({
          id: `ads-${now.getTime()}-4`,
          type: "AD_CREATED",
          description: `${newAds} new ad${newAds > 1 ? "s" : ""} created`,
          timestamp: now.toISOString(),
        });
      }
    }

    // If no activities, return empty array
    return activities;
  }
}
