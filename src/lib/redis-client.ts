import Redis from "ioredis";
import env from "@/config/env";
import { logger } from "@/utils/logger";

export class RedisClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private readonly maxConnectionAttempts = 3;

  constructor() {
    if (env.REDIS_ENABLED) {
      this.initialize();
    }
  }

  /**
   * Initialize Redis connection
   */
  private initialize(): void {
    try {
      this.client = new Redis(env.REDIS_URL, {
        retryStrategy: (times) => {
          if (times > this.maxConnectionAttempts) {
            logger.error("Redis connection failed after max attempts");
            return null; // Stop retrying
          }
          const delay = Math.min(times * 200, 2000);
          logger.warn(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      this.client.on("connect", () => {
        logger.info("Redis client connecting...");
      });

      this.client.on("ready", () => {
        this.isConnected = true;
        logger.info("✅ Redis client connected and ready");
      });

      this.client.on("error", (error) => {
        this.isConnected = false;
        logger.error("Redis client error:", error);
      });

      this.client.on("close", () => {
        this.isConnected = false;
        logger.warn("Redis client connection closed");
      });

      // Attempt to connect
      this.client.connect().catch((error) => {
        logger.error("Failed to connect to Redis:", error);
        this.isConnected = false;
      });
    } catch (error) {
      logger.error("Failed to initialize Redis client:", error);
      this.isConnected = false;
    }
  }

  /**
   * Check if Redis is available
   */
  private isAvailable(): boolean {
    return env.REDIS_ENABLED && this.client !== null && this.isConnected;
  }

  /**
   * Get cached value
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.client!.get(key);
      return value;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value with optional TTL
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      if (ttl) {
        await this.client!.setex(key, ttl, value);
      } else {
        await this.client!.set(key, value);
      }
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.client!.del(key);
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete all keys matching pattern
   */
  async flush(pattern: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const stream = this.client!.scanStream({
        match: pattern,
        count: 100,
      });

      const pipeline = this.client!.pipeline();
      let keysCount = 0;

      stream.on("data", (keys: string[]) => {
        if (keys.length) {
          keys.forEach((key) => {
            pipeline.del(key);
            keysCount++;
          });
        }
      });

      stream.on("end", async () => {
        if (keysCount > 0) {
          await pipeline.exec();
          logger.info(`Flushed ${keysCount} keys matching pattern: ${pattern}`);
        }
      });

      stream.on("error", (error) => {
        logger.error(`Redis flush error for pattern ${pattern}:`, error);
      });
    } catch (error) {
      logger.error(`Redis flush error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Get multiple keys
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.isAvailable() || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      return await this.client!.mget(...keys);
    } catch (error) {
      logger.error(`Redis mget error:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, string>, ttl?: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const pipeline = this.client!.pipeline();
      for (const [key, value] of Object.entries(keyValuePairs)) {
        if (ttl) {
          pipeline.setex(key, ttl, value);
        } else {
          pipeline.set(key, value);
        }
      }
      await pipeline.exec();
    } catch (error) {
      logger.error(`Redis mset error:`, error);
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info("Redis client disconnected");
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { enabled: boolean; connected: boolean } {
    return {
      enabled: env.REDIS_ENABLED,
      connected: this.isConnected,
    };
  }
}

// Export singleton instance
export const redisClient = new RedisClient();
