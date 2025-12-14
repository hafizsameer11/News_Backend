import { redisClient } from "@/lib/redis-client";
import env from "@/config/env";
import { logger } from "@/utils/logger";

export class CacheService {
  private readonly defaultTTL: number;

  constructor() {
    this.defaultTTL = env.CACHE_TTL_SECONDS;
  }

  /**
   * Get value from cache or fetch and cache it
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    // Try to get from cache
    const cached = await redisClient.get(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        logger.debug(`Cache hit for key: ${key}`);
        return parsed as T;
      } catch (error) {
        logger.warn(`Failed to parse cached value for key ${key}, fetching fresh data`);
      }
    }

    // Cache miss - fetch fresh data
    logger.debug(`Cache miss for key: ${key}`);
    const data = await fetcher();

    // Store in cache
    try {
      const serialized = JSON.stringify(data);
      await redisClient.set(key, serialized, ttl || this.defaultTTL);
    } catch (error) {
      logger.error(`Failed to cache data for key ${key}:`, error);
      // Continue even if caching fails
    }

    return data;
  }

  /**
   * Get value from cache (returns null if not found)
   */
  async get<T>(key: string): Promise<T | null> {
    const cached = await redisClient.get(key);
    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error(`Failed to parse cached value for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await redisClient.set(key, serialized, ttl || this.defaultTTL);
    } catch (error) {
      logger.error(`Failed to set cache for key ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    await redisClient.del(key);
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    await redisClient.flush(pattern);
  }

  /**
   * Invalidate all news-related cache
   */
  async invalidateNews(newsId?: string): Promise<void> {
    if (newsId) {
      // Invalidate specific news cache
      await this.delete(`news:${newsId}`);
      await this.delete(`news:slug:*`);
    }
    // Invalidate all news-related cache
    await this.invalidate("news:*");
    await this.invalidate("search:*");
    await this.invalidate("sitemap:*");
    await this.invalidate("seo:news:*");
    await this.invalidate("structured-data:news:*");
  }

  /**
   * Invalidate all category-related cache
   */
  async invalidateCategory(categoryId?: string): Promise<void> {
    if (categoryId) {
      // Invalidate specific category cache
      await this.delete(`category:${categoryId}`);
      await this.delete(`category:slug:*`);
    }
    // Invalidate all category-related cache
    await this.invalidate("category:*");
    await this.invalidate("search:*");
    await this.invalidate("sitemap:*");
    await this.invalidate("seo:category:*");
    await this.invalidate("structured-data:category:*");
  }

  /**
   * Invalidate all search cache
   */
  async invalidateSearch(): Promise<void> {
    await this.invalidate("search:*");
  }

  /**
   * Invalidate sitemap cache
   */
  async invalidateSitemap(): Promise<void> {
    await this.invalidate("sitemap:*");
  }

  /**
   * Invalidate SEO metadata cache
   */
  async invalidateSEO(): Promise<void> {
    await this.invalidate("seo:*");
    await this.invalidate("structured-data:*");
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    return await redisClient.exists(key);
  }

  /**
   * Get cache statistics (if available)
   */
  getStatus(): { enabled: boolean; connected: boolean } {
    return redisClient.getConnectionStatus();
  }
}

// Export singleton instance
export const cacheService = new CacheService();
