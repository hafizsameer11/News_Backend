import prisma from "@/config/prisma";
import { cacheService } from "./cache.service";
import { NEWS_STATUS, ROLE } from "@/types/enums";
import { Role } from "@prisma/client";
import { breakingNewsService } from "./breaking-news.service";
import { logger } from "@/utils/logger";
import { ga4Client } from "@/lib/ga4-client";
import { sanitizeHtmlContent } from "@/utils/sanitize";
import { getAbsoluteUrl, normalizeUrl } from "@/utils/url";
import { SocialService } from "./social.service";
import { PLATFORM } from "@/types/enums";
import ExcelJS from "exceljs";

export class NewsService {
  /**
   * Helper function to convert relative URLs to absolute URLs in news objects
   */
  private convertNewsUrls(news: any): any {
    if (!news) return news;
    if (Array.isArray(news)) {
      return news.map((item: any) => this.convertNewsUrls(item));
    }
    // Only convert if mainImage exists and is not already absolute
    // getAbsoluteUrl() will normalize duplicate prefixes if needed
    let mainImage = news.mainImage;
    if (mainImage) {
      mainImage = getAbsoluteUrl(mainImage);
    }
    return {
      ...news,
      mainImage,
    };
  }

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
      news: this.convertNewsUrls(news),
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

    return this.convertNewsUrls(news);
  }

  /**
   * Create news
   */
  async createNews(data: any, userId: string) {
    // Check slug uniqueness
    const existing = await prisma.news.findUnique({ where: { slug: data.slug } });
    if (existing) {
      const error: any = new Error("A news article with this slug already exists. Please use a different slug.");
      error.statusCode = 409;
      throw error;
    }

    // Verify category exists
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error("Category not found");

    // Check category permissions for Editor and Pro Loco
    // (This logic could be in controller or here)
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { 
          allowedCategories: true,
          prolocoAllowedCategories: true,
        } as any,
      });
    } catch (error: any) {
      // If _EditorCategories or _ProlocoCategories tables don't exist, get user without categories
      if (error.message?.includes("_EditorCategories") || error.message?.includes("_ProlocoCategories") || error.message?.includes("does not exist")) {
        logger.warn("Category relation tables not found, fetching user without categories");
        user = await prisma.user.findUnique({
          where: { id: userId },
        });
        // Add empty categories array to match expected structure
        if (user) {
          (user as any).allowedCategories = [];
          (user as any).prolocoAllowedCategories = [];
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

    // Check category permissions for Pro Loco
    if (user?.role === Role.PROLOCO) {
      // Pro Loco users must be approved
      if ((user as any).prolocoStatus !== "APPROVED") {
        throw new Error("Your Pro Loco account is pending approval. Please wait for admin approval.");
      }

      const allowedCategories = (user as any).prolocoAllowedCategories || [];
      const hasPermission = allowedCategories.some((c: any) => c.id === data.categoryId);
      if (!hasPermission) {
        throw new Error("You do not have permission to post in this category. Please contact admin to assign categories.");
      }

      // Pro Loco posts always go to PENDING_REVIEW (admin must approve)
      if (data.status === NEWS_STATUS.PUBLISHED) {
        data.status = NEWS_STATUS.PENDING_REVIEW;
      }
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

    // Remove mainImageId and socialMediaPlatforms if present (not in schema)
    const { mainImageId: _mainImageId, socialMediaPlatforms: _socialMediaPlatforms, ...newsData } = data;

    // Convert mainImage URL to absolute if provided
    // Only convert if it's a relative URL, otherwise use as-is (already absolute)
    if (newsData.mainImage) {
      // If already absolute, normalize it (remove any duplicate prefixes)
      if (newsData.mainImage.startsWith("http://") || newsData.mainImage.startsWith("https://")) {
        // Normalize to remove duplicate domain prefixes
        newsData.mainImage = normalizeUrl(newsData.mainImage);
      } else {
        // Convert relative URL to absolute
        newsData.mainImage = getAbsoluteUrl(newsData.mainImage);
      }
    }

    // Use provided publishedAt if available, otherwise set to current date when publishing
    let publishedAtValue: Date | null = null;
    if (data.status === NEWS_STATUS.PUBLISHED) {
      if (data.publishedAt) {
        publishedAtValue = new Date(data.publishedAt);
      } else {
        publishedAtValue = new Date();
      }
    }

    const news = await prisma.news.create({
      data: {
        ...newsData,
        content: sanitizedContent,
        summary: sanitizedSummary,
        authorId: userId,
        publishedAt: publishedAtValue,
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

    // Post to social media if news is published and platforms are specified
    if (data.status === NEWS_STATUS.PUBLISHED && _socialMediaPlatforms) {
      const platforms = _socialMediaPlatforms as PLATFORM[];
      if (platforms && Array.isArray(platforms) && platforms.length > 0) {
        try {
          const socialService = new SocialService();
          await socialService.postToSocial(news.id, platforms);
        } catch (error) {
          // Log error but don't fail the news creation
          logger.error("Failed to post to social media:", error);
        }
      }
    }

    return this.convertNewsUrls(news);
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
            include: { 
              allowedCategories: true,
              prolocoAllowedCategories: true,
            },
          });
        } catch (error: any) {
          // If _EditorCategories or _ProlocoCategories tables don't exist, get user without categories
          if (error.message?.includes("_EditorCategories") || error.message?.includes("_ProlocoCategories") || error.message?.includes("does not exist")) {
            logger.warn("Category relation tables not found, fetching user without categories");
            user = await prisma.user.findUnique({
              where: { id: userId },
            });
            // Add empty categories array to match expected structure
            if (user) {
              (user as any).allowedCategories = [];
              (user as any).prolocoAllowedCategories = [];
            }
          } else {
            throw error;
          }
        }

        if (user) {
          if (user.role === ROLE.EDITOR) {
            const allowedCategories = (user as any).allowedCategories || [];
            const hasPermission = allowedCategories.some((c: any) => c.id === data.categoryId);
            if (!hasPermission) {
              throw new Error("You do not have permission to post in this category");
            }
          } else if (user.role === Role.PROLOCO) {
            if ((user as any).prolocoStatus !== "APPROVED") {
              throw new Error("Your Pro Loco account is pending approval.");
            }
            const allowedCategories = (user as any).prolocoAllowedCategories || [];
            const hasPermission = allowedCategories.some((c: any) => c.id === data.categoryId);
            if (!hasPermission) {
              throw new Error("You do not have permission to post in this category. Please contact admin to assign categories.");
            }
            // Pro Loco posts always go to PENDING_REVIEW
            if (data.status === NEWS_STATUS.PUBLISHED) {
              data.status = NEWS_STATUS.PENDING_REVIEW;
            }
          }
        }
      }
    }

    // Check slug if changing
    if (data.slug) {
      const existing = await prisma.news.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== id) {
        const error: any = new Error("A news article with this slug already exists. Please use a different slug.");
        error.statusCode = 409;
        throw error;
      }
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
    // Remove mainImageId and socialMediaPlatforms if present (not in schema)
    const { mainImageId: _mainImageId, socialMediaPlatforms: _socialMediaPlatforms, ...restData } = data;
    const updateData: any = { ...restData };
    if (data.content) {
      updateData.content = sanitizeHtmlContent(data.content);
    }
    if (data.summary) {
      updateData.summary = sanitizeHtmlContent(data.summary);
    }
    // Convert mainImage URL to absolute if provided
    // Only convert if it's a relative URL, otherwise use as-is (already absolute)
    if (updateData.mainImage) {
      // If already absolute, normalize it (remove any duplicate prefixes)
      if (updateData.mainImage.startsWith("http://") || updateData.mainImage.startsWith("https://")) {
        // Normalize to remove duplicate domain prefixes
        updateData.mainImage = normalizeUrl(updateData.mainImage);
      } else {
        // Convert relative URL to absolute
        updateData.mainImage = getAbsoluteUrl(updateData.mainImage);
      }
    }

    // Handle publishedAt: use provided value, or set to current date when publishing for first time, or keep existing
    let publishedAtValue = news.publishedAt;
    if (data.status === NEWS_STATUS.PUBLISHED) {
      if (data.publishedAt) {
        // Use provided retroactive date
        publishedAtValue = new Date(data.publishedAt);
      } else if (news.status !== NEWS_STATUS.PUBLISHED) {
        // First time publishing, use current date
        publishedAtValue = new Date();
      }
      // If already published and no new publishedAt provided, keep existing
    } else if (data.publishedAt !== undefined) {
      // Allow setting publishedAt even if status is not PUBLISHED (for drafts with retroactive date)
      publishedAtValue = data.publishedAt ? new Date(data.publishedAt) : null;
    }

    const updatedNews = await prisma.news.update({
      where: { id },
      data: {
        ...updateData,
        publishedAt: publishedAtValue,
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

    // Post to social media if news is published and platforms are specified
    if (data.status === NEWS_STATUS.PUBLISHED && _socialMediaPlatforms) {
      const platforms = _socialMediaPlatforms as PLATFORM[];
      if (platforms && Array.isArray(platforms) && platforms.length > 0) {
        try {
          const socialService = new SocialService();
          await socialService.postToSocial(updatedNews.id, platforms);
        } catch (error) {
          // Log error but don't fail the news update
          logger.error("Failed to post to social media:", error);
        }
      }
    }

    return this.convertNewsUrls(updatedNews);
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

    // Delete related records that don't have cascade delete
    // This must be done before deleting the news to avoid foreign key constraint errors
    await Promise.all([
      // Delete media gallery items
      prisma.media.deleteMany({ where: { newsId: id } }),
      // Delete social post logs
      prisma.socialPostLog.deleteMany({ where: { newsId: id } }),
      // Delete breaking news alerts
      prisma.breakingNewsAlert.deleteMany({ where: { newsId: id } }),
    ]);

    // Invalidate cache before deletion
    await cacheService.invalidateNews(id);
    if (news.status === NEWS_STATUS.PUBLISHED) {
      await cacheService.invalidateSitemap();
    }

    // Delete the news (bookmarks and viewLogs will be deleted automatically due to cascade)
    return await prisma.news.delete({ where: { id } });
  }

  /**
   * Export all news to Excel
   */
  async exportNewsToExcel(): Promise<Buffer> {
    // Fetch all news with all related data
    const allNews = await prisma.news.findMany({
      include: {
        category: { select: { id: true, nameEn: true, nameIt: true, slug: true } },
        author: { select: { id: true, name: true, email: true } },
        gallery: { select: { id: true, url: true, type: true, caption: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("News");

    // Define columns
    worksheet.columns = [
      { header: "ID", key: "id", width: 36 },
      { header: "Title", key: "title", width: 40 },
      { header: "Slug", key: "slug", width: 40 },
      { header: "Summary", key: "summary", width: 50 },
      { header: "Content", key: "content", width: 80 },
      { header: "Main Image URL", key: "mainImage", width: 50 },
      { header: "Gallery Images", key: "gallery", width: 80 },
      { header: "Category (EN)", key: "categoryEn", width: 25 },
      { header: "Category (IT)", key: "categoryIt", width: 25 },
      { header: "Category Slug", key: "categorySlug", width: 30 },
      { header: "Author Name", key: "authorName", width: 25 },
      { header: "Author Email", key: "authorEmail", width: 30 },
      { header: "Status", key: "status", width: 15 },
      { header: "Language", key: "language", width: 10 },
      { header: "Is Breaking", key: "isBreaking", width: 12 },
      { header: "Is Featured", key: "isFeatured", width: 12 },
      { header: "Is TG", key: "isTG", width: 8 },
      { header: "Tags", key: "tags", width: 30 },
      { header: "Views", key: "views", width: 10 },
      { header: "Published At", key: "publishedAt", width: 20 },
      { header: "Scheduled For", key: "scheduledFor", width: 20 },
      { header: "Created At", key: "createdAt", width: 20 },
      { header: "Updated At", key: "updatedAt", width: 20 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Add data rows
    allNews.forEach((news) => {
      // Convert gallery images to a string (comma-separated URLs)
      const galleryUrls = news.gallery
        .map((media) => {
          const url = getAbsoluteUrl(media.url);
          return media.caption ? `${url} (${media.caption})` : url;
        })
        .join("; ");

      // Format dates
      const formatDate = (date: Date | null) => {
        if (!date) return "";
        return new Date(date).toISOString().replace("T", " ").split(".")[0];
      };

      worksheet.addRow({
        id: news.id,
        title: news.title,
        slug: news.slug,
        summary: news.summary || "",
        content: news.content || "",
        mainImage: news.mainImage ? getAbsoluteUrl(news.mainImage) : "",
        gallery: galleryUrls,
        categoryEn: news.category?.nameEn || "",
        categoryIt: news.category?.nameIt || "",
        categorySlug: news.category?.slug || "",
        authorName: news.author?.name || "",
        authorEmail: news.author?.email || "",
        status: news.status,
        language: news.language,
        isBreaking: news.isBreaking ? "Yes" : "No",
        isFeatured: news.isFeatured ? "Yes" : "No",
        isTG: news.isTG ? "Yes" : "No",
        tags: news.tags || "",
        views: news.views || 0,
        publishedAt: formatDate(news.publishedAt),
        scheduledFor: formatDate(news.scheduledFor),
        createdAt: formatDate(news.createdAt),
        updatedAt: formatDate(news.updatedAt),
      });
    });

    // Freeze the header row
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
