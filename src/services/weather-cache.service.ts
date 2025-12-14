import prisma from "@/config/prisma";
import { WeatherData } from "@/lib/openweather.client";
import { logger } from "@/utils/logger";

/**
 * Cache TTL: 1 hour (3600000 ms)
 */
const CACHE_TTL_MS = 60 * 60 * 1000;

export class WeatherCacheService {
  /**
   * Get cached weather data if fresh (< 1 hour old)
   * @param cityId - City ID
   * @returns Cached weather data or null if stale/missing
   */
  async getCachedWeather(cityId: string): Promise<WeatherData | null> {
    try {
      const cache = await prisma.weatherCache.findUnique({
        where: { cityId },
        include: { city: true },
      });

      if (!cache) {
        logger.debug(`No cache found for city ${cityId}`);
        return null;
      }

      // Check if cache is still fresh (less than 1 hour old)
      const now = new Date();
      const cacheAge = now.getTime() - cache.updatedAt.getTime();

      if (cacheAge > CACHE_TTL_MS) {
        logger.debug(
          `Cache expired for city ${cityId} (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`
        );
        return null;
      }

      // Parse full data from JSON string
      let fullData = null;
      try {
        fullData = JSON.parse(cache.data);
      } catch (e) {
        logger.warn(`Failed to parse cached data for city ${cityId}`);
      }

      // Return cached data
      const weatherData: WeatherData = {
        city: cache.cityName,
        temperature: Number(cache.temperature),
        condition: cache.condition,
        humidity: cache.humidity,
        windSpeed: Number(cache.windSpeed),
        description: fullData?.weather?.[0]?.description || "",
        icon: fullData?.weather?.[0]?.icon,
        feelsLike: fullData?.main?.feels_like
          ? Math.round(fullData.main.feels_like * 10) / 10
          : undefined,
        pressure: fullData?.main?.pressure,
        visibility: fullData?.visibility,
        cloudiness: fullData?.clouds?.all,
        windDirection: fullData?.wind?.deg,
        sunrise: fullData?.sys?.sunrise ? fullData.sys.sunrise * 1000 : undefined,
        sunset: fullData?.sys?.sunset ? fullData.sys.sunset * 1000 : undefined,
        updatedAt: cache.updatedAt,
        fullData: fullData || undefined,
      };

      logger.debug(`Cache hit for city ${cityId}`);
      return weatherData;
    } catch (error) {
      logger.error(`Error getting cached weather for city ${cityId}:`, error);
      return null;
    }
  }

  /**
   * Store weather data in cache
   * @param cityId - City ID
   * @param data - Weather data to cache
   */
  async setCachedWeather(cityId: string, data: WeatherData): Promise<void> {
    try {
      // Convert fullData to JSON string
      const dataJson = data.fullData ? JSON.stringify(data.fullData) : JSON.stringify(data);

      await prisma.weatherCache.upsert({
        where: { cityId },
        update: {
          cityName: data.city,
          temperature: data.temperature,
          condition: data.condition,
          humidity: data.humidity,
          windSpeed: data.windSpeed,
          data: dataJson,
          updatedAt: new Date(),
        },
        create: {
          cityId,
          cityName: data.city,
          temperature: data.temperature,
          condition: data.condition,
          humidity: data.humidity,
          windSpeed: data.windSpeed,
          data: dataJson,
        },
      });

      logger.debug(`Cached weather data for city ${cityId}`);
    } catch (error) {
      logger.error(`Error caching weather for city ${cityId}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate cache for a specific city or all cities
   * @param cityId - Optional city ID. If not provided, clears all cache
   */
  async invalidateCache(cityId?: string): Promise<void> {
    try {
      if (cityId) {
        await prisma.weatherCache.delete({
          where: { cityId },
        });
        logger.info(`Invalidated cache for city ${cityId}`);
      } else {
        await prisma.weatherCache.deleteMany({});
        logger.info("Invalidated all weather cache");
      }
    } catch (error) {
      logger.error(`Error invalidating cache:`, error);
      throw error;
    }
  }

  /**
   * Get cache age for a city (in milliseconds)
   * @param cityId - City ID
   * @returns Cache age in milliseconds, or null if no cache exists
   */
  async getCacheAge(cityId: string): Promise<number | null> {
    try {
      const cache = await prisma.weatherCache.findUnique({
        where: { cityId },
        select: { updatedAt: true },
      });

      if (!cache) {
        return null;
      }

      return new Date().getTime() - cache.updatedAt.getTime();
    } catch (error) {
      logger.error(`Error getting cache age for city ${cityId}:`, error);
      return null;
    }
  }
}
