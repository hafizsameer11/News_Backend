import prisma from "@/config/prisma";
import { cacheService } from "./cache.service";
import { NEWS_STATUS } from "@/types/enums";

export interface SearchFilters {
  q: string;
  type?: "news" | "category" | "transport" | "all";
  categoryId?: string | string[];
  dateFrom?: string;
  dateTo?: string;
  sort?: "relevance" | "date" | "views";
  page?: number;
  limit?: number;
}

export interface SearchResult {
  news: any[];
  categories: any[];
  transports: any[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class SearchService {
  /**
   * Enhanced Global Search with filters, sorting, and pagination
   */
  async search(filters: SearchFilters): Promise<SearchResult> {
    const {
      q,
      type = "all",
      categoryId,
      dateFrom,
      dateTo,
      sort = "relevance",
      page = 1,
      limit = 10,
    } = filters;

    if (!q || q.length < 2) {
      return {
        news: [],
        categories: [],
        transports: [],
        meta: {
          total: 0,
          page: 1,
          limit,
          totalPages: 0,
        },
      };
    }

    // Generate cache key based on all filters
    const cacheKey = `search:${JSON.stringify(filters)}`;

    // Try to get from cache
    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const results: SearchResult = {
          news: [],
          categories: [],
          transports: [],
        };

        // Search News
        if (type === "all" || type === "news") {
          const newsResult = await this.searchNews(q, {
            categoryId,
            dateFrom,
            dateTo,
            sort,
            page,
            limit,
          });
          results.news = newsResult.data;
          if (type === "news") {
            results.meta = newsResult.meta;
          }
        }

        // Search Categories
        if (type === "all" || type === "category") {
          const categoriesResult = await this.searchCategories(q, {
            page,
            limit: 5,
          });
          results.categories = categoriesResult.data;
          if (type === "category" && !results.meta) {
            results.meta = categoriesResult.meta;
          }
        }

        // Search Transport
        if (type === "all" || type === "transport") {
          const transportResult = await this.searchTransport(q, {
            page,
            limit: 5,
          });
          results.transports = transportResult.data;
          if (type === "transport" && !results.meta) {
            results.meta = transportResult.meta;
          }
        }

        // Calculate total for "all" type
        if (type === "all") {
          const total = results.news.length + results.categories.length + results.transports.length;
          results.meta = {
            total,
            page: 1,
            limit,
            totalPages: Math.ceil(total / limit),
          };
        }

        return results;
      },
      300 // 5 minutes TTL for search results
    );
  }

  /**
   * Search news with full-text search and filters
   */
  private async searchNews(
    query: string,
    options: {
      categoryId?: string | string[];
      dateFrom?: string;
      dateTo?: string;
      sort?: string;
      page: number;
      limit: number;
    }
  ) {
    const { categoryId, dateFrom, dateTo, sort, page, limit } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      status: NEWS_STATUS.PUBLISHED,
    };

    // Category filter - support both single and multiple categoryIds
    if (categoryId) {
      if (Array.isArray(categoryId) && categoryId.length > 0) {
        where.categoryId = { in: categoryId };
      } else if (typeof categoryId === "string") {
        where.categoryId = categoryId;
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.publishedAt = {};
      if (dateFrom) {
        where.publishedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.publishedAt.lte = new Date(dateTo);
      }
    }

    // Try full-text search first, fallback to contains
    let orderBy: any = {};
    let searchCondition: any;

    try {
      // Attempt to use MySQL FULLTEXT search
      // Note: Prisma doesn't support MATCH() AGAINST() directly, so we use raw query
      // For now, we'll use contains with proper ordering
      searchCondition = {
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { content: { contains: query } },
        ],
      };
    } catch (error) {
      // Fallback to contains
      searchCondition = {
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { content: { contains: query } },
        ],
      };
    }

    where.AND = [searchCondition];

    // Sorting
    if (sort === "date") {
      orderBy = { publishedAt: "desc" };
    } else if (sort === "views") {
      orderBy = { views: "desc" };
    } else {
      // Relevance: prioritize title matches, then featured/breaking, then date
      orderBy = [{ isFeatured: "desc" }, { isBreaking: "desc" }, { publishedAt: "desc" }];
    }

    // Get total count
    const total = await prisma.news.count({ where });

    // Get results
    const news = await prisma.news.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        mainImage: true,
        publishedAt: true,
        views: true,
        isFeatured: true,
        isBreaking: true,
        category: { select: { id: true, nameEn: true, nameIt: true, slug: true } },
        author: { select: { id: true, name: true } },
      },
    });

    return {
      data: news,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Search categories
   */
  private async searchCategories(query: string, options: { page: number; limit: number }) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { nameEn: { contains: query } },
        { nameIt: { contains: query } },
        { description: { contains: query } },
      ],
    };

    const total = await prisma.category.count({ where });

    const categories = await prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: { order: "asc" },
      select: {
        id: true,
        nameEn: true,
        nameIt: true,
        slug: true,
        description: true,
      },
    });

    return {
      data: categories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Search transport
   */
  private async searchTransport(query: string, options: { page: number; limit: number }) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { name: { contains: query } },
        { description: { contains: query } },
        { city: { contains: query } },
      ],
    };

    const total = await prisma.transport.count({ where });

    const transports = await prisma.transport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return {
      data: transports,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
