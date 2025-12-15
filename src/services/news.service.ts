import prisma from "@/config/prisma";
import { cacheService } from "./cache.service";
import { NEWS_STATUS, ROLE } from "@/types/enums";
import { breakingNewsService } from "./breaking-news.service";
import { logger } from "@/utils/logger";
import { ga4Client } from "@/lib/ga4-client";
import { sanitizeHtmlContent } from "@/utils/sanitize";

export class NewsService {
  /**
   * Get all news (Public/Filtered)
   */
  async getAllNews(query: any) {
    const {
      page = 1,
      limit = 10,
      status,
      categoryId,
      isBreaking,
      isFeatured,
      isTG,
      search,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    // Filters
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (isBreaking === "true") where.isBreaking = true;
    if (isFeatured === "true") where.isFeatured = true;
    if (isTG === "true") where.isTG = true;

    // Search
    if (search) {
      where.OR = [
        { title: { contains: search } }, // removed mode: 'insensitive' for mysql
        { summary: { contains: search } }, // removed mode: 'insensitive' for mysql
      ];
    }

    // Fetch
    const now = new Date();

    // If accessing publicly (i.e. not specifically asking for drafts/pending via Admin UI),
    // we should restrict to Published and Past/Present dates.
    // Note: 'status' param is usually passed by Admin. If no status passed, assume public feed?
    // Better approach: If no status is provided, default to PUBLISHED for public safety.
    // Admin UI should explicitly request status=DRAFT etc.

    if (!status) {
      where.status = NEWS_STATUS.PUBLISHED;
      // Also ensure publishedAt is in the past (handled by scheduledFor check logic usually)
      // If we use 'publishedAt' as the release date:
      where.publishedAt = { lte: now };

      // If using scheduledFor logic:
      // where.OR = [
      //   { scheduledFor: null },
      //   { scheduledFor: { lte: now } }
      // ];
    }

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          category: { select: { id: true, nameEn: true, nameIt: true, slug: true } },
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.news.count({ where }),
    ]);

    return {
      news,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Get single news by Slug or ID
   * Tracks view count and creates view log entry
   */
  async getNewsByIdOrSlug(
    identifier: string,
    options?: { userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    // Check if identifier is a UUID (standard format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier
    );

    // Try to find news by ID if it's a UUID, otherwise by slug
    let news = null;
    if (isUuid) {
      news = await prisma.news.findUnique({
        where: { id: identifier },
        include: {
          category: true,
          author: { select: { id: true, name: true, avatar: true } },
          gallery: true,
        },
      });
    } else {
      news = await prisma.news.findUnique({
        where: { slug: identifier },
        include: {
          category: true,
          author: { select: { id: true, name: true, avatar: true } },
          gallery: true,
        },
      });
    }

    // If not found by the first method, try the other method as fallback
    // This handles edge cases where a slug might look like a UUID or vice versa
    if (!news) {
      if (isUuid) {
        // If UUID lookup failed, try slug (unlikely but possible)
        news = await prisma.news.findUnique({
          where: { slug: identifier },
          include: {
            category: true,
            author: { select: { id: true, name: true, avatar: true } },
            gallery: true,
          },
        });
      } else {
        // If slug lookup failed, try ID (in case slug is actually a UUID)
        news = await prisma.news.findUnique({
          where: { id: identifier },
          include: {
            category: true,
            author: { select: { id: true, name: true, avatar: true } },
            gallery: true,
          },
        });
      }
    }

    if (!news) {
      const error: any = new Error("News article not found");
      error.statusCode = 404;
      throw error;
    }

    // Track view asynchronously (don't block response)
    setImmediate(async () => {
      try {
        // Increment view count atomically
        await prisma.news.update({
          where: { id: news.id },
          data: { views: { increment: 1 } },
        });

        // Create view log entry for analytics
        await prisma.newsViewLog.create({
          data: {
            newsId: news.id,
            userId: options?.userId || null,
            ipAddress: options?.ipAddress || null,
            userAgent: options?.userAgent || null,
          },
        });

        // Send GA4 page_view event
        await ga4Client.trackPageView(`/news/${news.slug}`, news.title, {
          userId: options?.userId,
        });
      } catch (error) {
        // Log error but don't break the request flow
        logger.error("Failed to track news view:", error);
      }
    });

    return news;
  }

  /**
   * Create news
   */
  async createNews(data: any, userId: string) {
    // Check slug uniqueness
    const existing = await prisma.news.findUnique({ where: { slug: data.slug } });
    if (existing) throw new Error("Slug already exists");

    // Verify category exists
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error("Category not found");

    // Check category permissions for Editor
    // (This logic could be in controller or here)
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { allowedCategories: true },
      });
    } catch (error: any) {
      // If _EditorCategories table doesn't exist, get user without categories
      if (error.message?.includes("_EditorCategories") || error.message?.includes("does not exist")) {
        logger.warn("_EditorCategories table not found, fetching user without categories");
        user = await prisma.user.findUnique({
          where: { id: userId },
        });
        // Add empty categories array to match expected structure
        if (user) {
          (user as any).allowedCategories = [];
        }
      } else {
        throw error;
      }
    }

    if (user?.role === ROLE.EDITOR) {
      const allowedCategories = (user as any).allowedCategories || [];
      const hasPermission = allowedCategories.some((c: any) => c.id === data.categoryId);
      if (!hasPermission) {
        throw new Error("You do not have permission to post in this category");
      }

      // Force Pending Review if config requires (SRS: 3.16.4)
      // For now assuming Editors can publish unless restricted
      // But let's default to PENDING_REVIEW for editors if status not explicitly set?
      // The validator defaults to DRAFT.
    }

    // Validate mainImage URL if provided
    if (data.mainImage) {
      const { MediaService } = await import("./media.service");
      const mediaService = new MediaService();
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const validation = await mediaService.validateMediaUrl(data.mainImage, userId, user?.role);
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid media URL");
      }
    }

    // Sanitize HTML content to prevent XSS attacks
    const sanitizedContent = data.content ? sanitizeHtmlContent(data.content) : data.content;
    const sanitizedSummary = data.summary ? sanitizeHtmlContent(data.summary) : data.summary;

    // Remove mainImageId if present (not in schema, only mainImage URL is stored)
    const { mainImageId: _mainImageId, ...newsData } = data;

    const news = await prisma.news.create({
      data: {
        ...newsData,
        content: sanitizedContent,
        summary: sanitizedSummary,
        authorId: userId,
        publishedAt: data.status === NEWS_STATUS.PUBLISHED ? new Date() : null,
      },
    });

    // Invalidate cache
    await cacheService.invalidateNews(news.id);
    if (data.status === NEWS_STATUS.PUBLISHED) {
      await cacheService.invalidateSitemap();
    }

    // Send breaking news alert if news is published and marked as breaking
    if (data.status === NEWS_STATUS.PUBLISHED && data.isBreaking) {
      try {
        await breakingNewsService.sendBreakingNewsAlert(news.id);
      } catch (error) {
        // Log error but don't fail the news creation
        logger.error("Failed to send breaking news alert:", error);
      }
    }

    return news;
  }

  /**
   * Update news
   */
  async updateNews(id: string, data: any, userId: string, userRole: ROLE) {
    const news = await prisma.news.findUnique({ where: { id } });
    if (!news) throw new Error("News not found");

    // Check permissions
    if (userRole === ROLE.EDITOR && news.authorId !== userId) {
      throw new Error("You can only edit your own articles");
    }

    // Verify category exists if changing
    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) throw new Error("Category not found");

      // Check editor permissions for new category
      if (userRole === ROLE.EDITOR) {
        let user;
        try {
          user = await prisma.user.findUnique({
            where: { id: userId },
            include: { allowedCategories: true },
          });
        } catch (error: any) {
          // If _EditorCategories table doesn't exist, get user without categories
          if (error.message?.includes("_EditorCategories") || error.message?.includes("does not exist")) {
            logger.warn("_EditorCategories table not found, fetching user without categories");
            user = await prisma.user.findUnique({
              where: { id: userId },
            });
            // Add empty categories array to match expected structure
            if (user) {
              (user as any).allowedCategories = [];
            }
          } else {
            throw error;
          }
        }

        if (user) {
          const allowedCategories = (user as any).allowedCategories || [];
          const hasPermission = allowedCategories.some((c: any) => c.id === data.categoryId);
          if (!hasPermission) {
            throw new Error("You do not have permission to post in this category");
          }
        }
      }
    }

    // Check slug if changing
    if (data.slug) {
      const existing = await prisma.news.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== id) throw new Error("Slug already exists");
    }

    // Validate mainImage URL if provided
    if (data.mainImage) {
      const { MediaService } = await import("./media.service");
      const mediaService = new MediaService();
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const validation = await mediaService.validateMediaUrl(data.mainImage, userId, user?.role);
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid media URL");
      }
    }

    // Sanitize HTML content if provided
    // Remove mainImageId if present (not in schema, only mainImage URL is stored)
    const { mainImageId: _mainImageId, ...restData } = data;
    const updateData: any = { ...restData };
    if (data.content) {
      updateData.content = sanitizeHtmlContent(data.content);
    }
    if (data.summary) {
      updateData.summary = sanitizeHtmlContent(data.summary);
    }

    const updatedNews = await prisma.news.update({
      where: { id },
      data: {
        ...updateData,
        publishedAt:
          data.status === NEWS_STATUS.PUBLISHED && news.status !== NEWS_STATUS.PUBLISHED
            ? new Date()
            : news.publishedAt,
      },
    });

    // Invalidate cache
    await cacheService.invalidateNews(id);
    if (data.status === NEWS_STATUS.PUBLISHED || news.status === NEWS_STATUS.PUBLISHED) {
      await cacheService.invalidateSitemap();
    }

    // Send breaking news alert if news status changed to PUBLISHED and is marked as breaking
    const isNowPublished =
      data.status === NEWS_STATUS.PUBLISHED && news.status !== NEWS_STATUS.PUBLISHED;
    const isBreaking = data.isBreaking !== undefined ? data.isBreaking : news.isBreaking;

    if (isNowPublished && isBreaking) {
      try {
        await breakingNewsService.sendBreakingNewsAlert(updatedNews.id);
      } catch (error) {
        // Log error but don't fail the news update
        logger.error("Failed to send breaking news alert:", error);
      }
    }

    return updatedNews;
  }

  /**
   * Delete news
   */
  async deleteNews(id: string, userId: string, userRole: ROLE) {
    const news = await prisma.news.findUnique({ where: { id } });
    if (!news) throw new Error("News not found");

    // Editors can only delete their own
    if (userRole === ROLE.EDITOR && news.authorId !== userId) {
      throw new Error("You can only delete your own articles");
    }

    // Invalidate cache before deletion
    await cacheService.invalidateNews(id);
    if (news.status === NEWS_STATUS.PUBLISHED) {
      await cacheService.invalidateSitemap();
    }

    return await prisma.news.delete({ where: { id } });
  }
}
