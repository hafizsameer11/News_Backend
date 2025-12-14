import prisma from "@/config/prisma";
import { NewsService } from "@/services/news.service";

const newsService = new NewsService();

export class TGService {
  /**
   * Get all TG Video News
   */
  async getAllTG(query: any) {
    // Force isTG filter
    return await newsService.getAllNews({ ...query, isTG: "true" });
  }

  /**
   * Get Featured TG News
   */
  async getFeaturedTG() {
    return await prisma.news.findMany({
      where: {
        isTG: true,
        isFeatured: true,
        status: "PUBLISHED",
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        author: { select: { name: true } },
        gallery: {
          where: { type: "VIDEO" },
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            duration: true,
            width: true,
            height: true,
            caption: true,
          },
        },
      },
    });
  }

  /**
   * Get Latest TG News
   */
  async getLatestTG(limit = 6) {
    return await prisma.news.findMany({
      where: {
        isTG: true,
        status: "PUBLISHED",
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        author: { select: { name: true } },
        gallery: {
          where: { type: "VIDEO" },
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            duration: true,
            width: true,
            height: true,
            caption: true,
          },
        },
      },
    });
  }

  /**
   * Get all TG videos with pagination and filters
   */
  async getAllVideos(query: any) {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      type: "VIDEO",
      news: {
        isTG: true,
        status: "PUBLISHED",
      },
    };

    if (category) {
      where.news = {
        ...where.news,
        categoryId: category,
      };
    }

    if (search) {
      where.news = {
        ...where.news,
        OR: [{ title: { contains: search } }, { summary: { contains: search } }],
      };
    }

    const orderBy: any = {};
    if (sortBy === "duration") {
      orderBy.duration = sortOrder;
    } else if (sortBy === "createdAt") {
      orderBy.createdAt = sortOrder;
    } else {
      orderBy.createdAt = "desc";
    }

    const [videos, total] = await Promise.all([
      prisma.media.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy,
        include: {
          news: {
            select: {
              id: true,
              title: true,
              slug: true,
              summary: true,
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
              createdAt: true,
            },
          },
        },
      }),
      prisma.media.count({ where }),
    ]);

    return {
      videos,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Get single TG video with full details
   */
  async getVideoById(id: string) {
    const video = await prisma.media.findFirst({
      where: {
        id,
        type: "VIDEO",
        news: {
          isTG: true,
          status: "PUBLISHED",
        },
      },
      include: {
        news: {
          include: {
            category: true,
            author: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            gallery: {
              where: { type: "VIDEO" },
              select: {
                id: true,
                url: true,
                thumbnailUrl: true,
                duration: true,
                caption: true,
              },
            },
          },
        },
      },
    });

    if (!video) {
      throw new Error("Video not found");
    }

    return video;
  }

  /**
   * Get related videos (same category)
   */
  async getRelatedVideos(videoId: string, limit = 6) {
    const video = await prisma.media.findUnique({
      where: { id: videoId },
      include: { news: { select: { categoryId: true } } },
    });

    if (!video || !video.news) {
      throw new Error("Video not found");
    }

    return await prisma.media.findMany({
      where: {
        type: "VIDEO",
        id: { not: videoId },
        news: {
          isTG: true,
          status: "PUBLISHED",
          categoryId: video.news.categoryId,
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        news: {
          select: {
            id: true,
            title: true,
            slug: true,
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
  }

  /**
   * Get popular TG videos (most viewed - using news views if available, or by date)
   */
  async getPopularVideos(limit = 10) {
    // For now, return latest videos as popular
    // In future, can add view tracking to News model
    return await prisma.media.findMany({
      where: {
        type: "VIDEO",
        news: {
          isTG: true,
          status: "PUBLISHED",
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        news: {
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
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
            createdAt: true,
          },
        },
      },
    });
  }
}
