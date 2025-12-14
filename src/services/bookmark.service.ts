import prisma from "@/config/prisma";
import { logger } from "@/utils/logger";

export class BookmarkService {
  /**
   * Save a bookmark
   */
  async saveBookmark(userId: string, newsId: string) {
    // Check if bookmark already exists
    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_newsId: {
          userId,
          newsId,
        },
      },
    });

    if (existing) {
      throw new Error("Bookmark already exists");
    }

    // Verify news exists
    const news = await prisma.news.findUnique({
      where: { id: newsId },
    });

    if (!news) {
      throw new Error("News article not found");
    }

    const bookmark = await prisma.bookmark.create({
      data: {
        userId,
        newsId,
      },
      include: {
        news: {
          select: {
            id: true,
            title: true,
            slug: true,
            mainImage: true,
            summary: true,
            createdAt: true,
            category: {
              select: {
                id: true,
                nameEn: true,
                nameIt: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    logger.info(`Bookmark created: ${bookmark.id}`);
    return bookmark;
  }

  /**
   * Get user's bookmarks
   */
  async getUserBookmarks(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          news: {
            select: {
              id: true,
              title: true,
              slug: true,
              mainImage: true,
              summary: true,
              createdAt: true,
              category: {
                select: {
                  id: true,
                  nameEn: true,
                  nameIt: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      prisma.bookmark.count({
        where: { userId },
      }),
    ]);

    return {
      bookmarks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Remove a bookmark
   */
  async removeBookmark(userId: string, bookmarkId: string) {
    const bookmark = await prisma.bookmark.findUnique({
      where: { id: bookmarkId },
    });

    if (!bookmark) {
      throw new Error("Bookmark not found");
    }

    if (bookmark.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await prisma.bookmark.delete({
      where: { id: bookmarkId },
    });

    logger.info(`Bookmark deleted: ${bookmarkId}`);
  }

  /**
   * Check if news is bookmarked
   */
  async isBookmarked(userId: string, newsId: string): Promise<boolean> {
    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_newsId: {
          userId,
          newsId,
        },
      },
    });

    return !!bookmark;
  }
}
