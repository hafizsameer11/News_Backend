import prisma from "@/config/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { logger } from "@/utils/logger";
import { NEWS_STATUS } from "@/types/enums";
import { calculateAdPrice, MIN_AD_DURATION_DAYS, MAX_AD_DURATION_DAYS } from "@/config/ad-pricing";

export class CrmService {
  /**
   * Register a new user via CRM
   * Users created via CRM can create news and ads
   */
  async registerUser(data: {
    email: string;
    password: string;
    name: string;
    role: "EDITOR" | "ADVERTISER" | "USER";
    companyName?: string;
  }) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role as any,
        companyName: data.companyName,
        isActive: true,
        emailVerified: true, // Auto-verify CRM users
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyName: true,
        createdAt: true,
        emailVerified: true,
      },
    });

    logger.info(`CRM: User registered via CRM - ${user.email} (${user.role})`);

    return user;
  }

  /**
   * Get all categories for news creation
   */
  async getCategories() {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        nameEn: true,
        nameIt: true,
        slug: true,
        parentId: true,
        order: true,
      },
      orderBy: [
        { order: "asc" },
        { nameEn: "asc" },
      ],
    });

    return categories;
  }

  /**
   * Create news article via CRM
   * CRM users can create news in any category and it will be auto-published
   */
  async createNews(
    data: {
      title: string;
      slug?: string;
      summary?: string;
      content: string;
      categoryId: string;
      status?: "DRAFT" | "PUBLISHED";
      isFeatured?: boolean;
      isBreaking?: boolean;
      tags?: string[];
      mainImage?: string;
      youtubeUrl?: string;
    },
    userId: string
  ) {
    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new Error("Category not found");
    }

    // Auto-publish if status is PUBLISHED or not specified
    const status = data.status || "PUBLISHED";
    const publishedAt = status === "PUBLISHED" ? new Date() : null;

    // Generate slug from title if not provided
    let slug = data.slug;
    if (!slug) {
      slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      // Fallback if slug is empty (shouldn't happen with valid title)
      if (!slug) {
        slug = `news-${Date.now()}`;
      }
    }

    // Generate summary from content if not provided
    let summary = data.summary;
    if (!summary) {
      // Extract first 200 characters from content (strip HTML tags)
      const textContent = data.content.replace(/<[^>]*>/g, "").trim();
      summary = textContent.substring(0, 200);
      if (textContent.length > 200) {
        summary += "...";
      }
      // Ensure summary is not empty
      if (!summary) {
        summary = data.title; // Fallback to title if content is empty
      }
    }

    // Create news with CRM privileges
    // CRM users can create news in any category
    const news = await prisma.news.create({
      data: {
        title: data.title,
        slug: slug,
        summary: summary,
        content: data.content,
        categoryId: data.categoryId,
        status: status as NEWS_STATUS,
        isFeatured: data.isFeatured || false,
        isBreaking: data.isBreaking || false,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        mainImage: data.mainImage || null,
        youtubeUrl: data.youtubeUrl ? data.youtubeUrl.trim() : null,
        publishedAt,
        authorId: userId,
      },
      include: {
        category: {
          select: {
            id: true,
            nameEn: true,
            nameIt: true,
            slug: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info(`CRM: News created via CRM - ${news.title} by user ${userId}`);

    return news;
  }

  /**
   * Create ad via CRM
   * Ads created via CRM are auto-approved and don't require payment
   */
  async createAd(
    data: {
      title: string;
      type: string;
      imageUrl: string;
      targetLink?: string;
      position?: string;
      startDate: string;
      endDate: string;
      price?: number;
    },
    userId: string
  ) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Validate dates
    if (start < now) {
      throw new Error("Start date cannot be in the past");
    }

    if (end <= start) {
      throw new Error("End date must be after start date");
    }

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    if (days < MIN_AD_DURATION_DAYS) {
      throw new Error(`Ad duration must be at least ${MIN_AD_DURATION_DAYS} day(s)`);
    }
    if (days > MAX_AD_DURATION_DAYS) {
      throw new Error(`Ad duration cannot exceed ${MAX_AD_DURATION_DAYS} days`);
    }

    // Calculate price if not provided
    let priceValue: number;
    if (data.price !== undefined && data.price !== null) {
      priceValue = typeof data.price === "string" ? parseFloat(data.price) : data.price;
    } else {
      priceValue = calculateAdPrice(data.type, start, end);
    }

    if (isNaN(priceValue) || priceValue < 0) {
      throw new Error("Price must be a valid positive number");
    }

    const MAX_PRICE = 99999999.99;
    if (priceValue > MAX_PRICE) {
      throw new Error(`Price cannot exceed ${MAX_PRICE.toLocaleString()}`);
    }

    const calculatedPrice = new Prisma.Decimal(Math.round(priceValue * 100) / 100);

    // Create ad with ACTIVE status and isPaid = true (CRM bypass)
    const ad = await prisma.ad.create({
      data: {
        title: data.title,
        type: data.type as any,
        imageUrl: data.imageUrl,
        targetLink: data.targetLink || null,
        position: data.position || null,
        startDate: start,
        endDate: end,
        advertiserId: userId,
        status: "ACTIVE",
        isPaid: true, // Auto-paid for CRM
        price: calculatedPrice,
      },
      include: {
        advertiser: {
          select: {
            id: true,
            name: true,
            email: true,
            companyName: true,
          },
        },
      },
    });

    logger.info(`CRM: Ad created and auto-approved via CRM - ${ad.title} by user ${userId}`);

    return ad;
  }

  /**
   * Get all news statistics (aggregate)
   * Returns comprehensive stats about all news articles
   */
  async getAllNewsStats() {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get basic counts
    const [
      totalNews,
      publishedNews,
      draftNews,
      pendingNews,
      rejectedNews,
      featuredNews,
      breakingNews,
      totalViews,
      newsLast7Days,
      newsLast30Days,
      viewsLast7Days,
      viewsLast30Days,
    ] = await Promise.all([
      prisma.news.count(),
      prisma.news.count({ where: { status: NEWS_STATUS.PUBLISHED } }),
      prisma.news.count({ where: { status: NEWS_STATUS.DRAFT } }),
      prisma.news.count({ where: { status: NEWS_STATUS.PENDING_REVIEW } }),
      prisma.news.count({ where: { status: NEWS_STATUS.REJECTED } }),
      prisma.news.count({ where: { isFeatured: true } }),
      prisma.news.count({ where: { isBreaking: true } }),
      prisma.news.aggregate({
        _sum: { views: true },
      }),
      prisma.news.count({
        where: { createdAt: { gte: last7Days } },
      }),
      prisma.news.count({
        where: { createdAt: { gte: last30Days } },
      }),
      prisma.newsViewLog.count({
        where: { viewedAt: { gte: last7Days } },
      }),
      prisma.newsViewLog.count({
        where: { viewedAt: { gte: last30Days } },
      }),
    ]);

    // Get top performing news (by views)
    const topNews = await prisma.news.findMany({
      take: 10,
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
            id: true,
            nameEn: true,
            nameIt: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get category breakdown
    const categoryStats = await prisma.news.groupBy({
      by: ["categoryId"],
      where: { status: NEWS_STATUS.PUBLISHED },
      _count: {
        id: true,
      },
      _sum: {
        views: true,
      },
    });

    // Get category names
    const categoryIds = categoryStats.map((stat) => stat.categoryId);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: {
        id: true,
        nameEn: true,
        nameIt: true,
        slug: true,
      },
    });

    const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
    const categoryBreakdown = categoryStats.map((stat) => ({
      categoryId: stat.categoryId,
      category: categoryMap.get(stat.categoryId) || null,
      newsCount: stat._count.id,
      totalViews: stat._sum.views || 0,
    }));

    // Calculate averages
    const averageViews = publishedNews > 0 ? Math.round((totalViews._sum.views || 0) / publishedNews) : 0;

    return {
      overview: {
        total: totalNews,
        published: publishedNews,
        draft: draftNews,
        pending: pendingNews,
        rejected: rejectedNews,
        featured: featuredNews,
        breaking: breakingNews,
      },
      views: {
        total: totalViews._sum.views || 0,
        average: averageViews,
        last7Days: viewsLast7Days,
        last30Days: viewsLast30Days,
      },
      recentActivity: {
        newsLast7Days,
        newsLast30Days,
      },
      topNews: topNews.map((news) => ({
        id: news.id,
        title: news.title,
        slug: news.slug,
        views: news.views,
        publishedAt: news.publishedAt,
        category: news.category,
        author: news.author,
      })),
      categoryBreakdown: categoryBreakdown.sort((a, b) => b.totalViews - a.totalViews),
    };
  }

  /**
   * Get news statistics for a specific user
   * Returns stats about news articles created by the specified user
   */
  async getUserNewsStats(userId: string) {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get basic counts for this user
    const [
      totalNews,
      publishedNews,
      draftNews,
      pendingNews,
      rejectedNews,
      featuredNews,
      breakingNews,
      totalViews,
      newsLast7Days,
      newsLast30Days,
    ] = await Promise.all([
      prisma.news.count({ where: { authorId: userId } }),
      prisma.news.count({
        where: { authorId: userId, status: NEWS_STATUS.PUBLISHED },
      }),
      prisma.news.count({
        where: { authorId: userId, status: NEWS_STATUS.DRAFT },
      }),
      prisma.news.count({
        where: { authorId: userId, status: NEWS_STATUS.PENDING_REVIEW },
      }),
      prisma.news.count({
        where: { authorId: userId, status: NEWS_STATUS.REJECTED },
      }),
      prisma.news.count({
        where: { authorId: userId, isFeatured: true },
      }),
      prisma.news.count({
        where: { authorId: userId, isBreaking: true },
      }),
      prisma.news.aggregate({
        where: { authorId: userId },
        _sum: { views: true },
      }),
      prisma.news.count({
        where: {
          authorId: userId,
          createdAt: { gte: last7Days },
        },
      }),
      prisma.news.count({
        where: {
          authorId: userId,
          createdAt: { gte: last30Days },
        },
      }),
    ]);

    // Get user's top performing news
    const topNews = await prisma.news.findMany({
      take: 10,
      where: {
        authorId: userId,
        status: NEWS_STATUS.PUBLISHED,
      },
      orderBy: { views: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        views: true,
        publishedAt: true,
        category: {
          select: {
            id: true,
            nameEn: true,
            nameIt: true,
          },
        },
      },
    });

    // Get category breakdown for this user
    const categoryStats = await prisma.news.groupBy({
      by: ["categoryId"],
      where: {
        authorId: userId,
        status: NEWS_STATUS.PUBLISHED,
      },
      _count: {
        id: true,
      },
      _sum: {
        views: true,
      },
    });

    // Get category names
    const categoryIds = categoryStats.map((stat) => stat.categoryId);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: {
        id: true,
        nameEn: true,
        nameIt: true,
        slug: true,
      },
    });

    const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
    const categoryBreakdown = categoryStats.map((stat) => ({
      categoryId: stat.categoryId,
      category: categoryMap.get(stat.categoryId) || null,
      newsCount: stat._count.id,
      totalViews: stat._sum.views || 0,
    }));

    // Calculate averages
    const averageViews = publishedNews > 0 ? Math.round((totalViews._sum.views || 0) / publishedNews) : 0;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return {
      user: user || null,
      overview: {
        total: totalNews,
        published: publishedNews,
        draft: draftNews,
        pending: pendingNews,
        rejected: rejectedNews,
        featured: featuredNews,
        breaking: breakingNews,
      },
      views: {
        total: totalViews._sum.views || 0,
        average: averageViews,
      },
      recentActivity: {
        newsLast7Days,
        newsLast30Days,
      },
      topNews: topNews.map((news) => ({
        id: news.id,
        title: news.title,
        slug: news.slug,
        views: news.views,
        publishedAt: news.publishedAt,
        category: news.category,
      })),
      categoryBreakdown: categoryBreakdown.sort((a, b) => b.totalViews - a.totalViews),
    };
  }
}

export const crmService = new CrmService();
