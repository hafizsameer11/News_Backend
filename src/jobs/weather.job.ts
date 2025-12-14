import { JobDefinition, JobStatus, JobResult } from "./types";
import { OpenWeatherMapClient } from "@/lib/openweather.client";
import { WeatherCacheService } from "@/services/weather-cache.service";
import { logger } from "@/utils/logger";
import prisma from "@/config/prisma";

/**
 * Weather Update Job
 * Fetches weather data for all active cities and updates cache
 * Runs every hour at minute 0
 */
export const weatherUpdateJob: JobDefinition = {
  name: "weather-update",
  schedule: "0 * * * *", // Every hour at minute 0
  enabled: true,
  execute: async (): Promise<JobResult> => {
    const startTime = Date.now();
    const weatherClient = new OpenWeatherMapClient();
    const cacheService = new WeatherCacheService();

    // Check if API is configured
    if (!weatherClient.isConfigured()) {
      return {
        status: JobStatus.FAILED,
        message: "OpenWeatherMap API key not configured",
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Get all active cities
      const cities = await prisma.weatherCity.findMany({
        where: { isActive: true },
      });

      if (cities.length === 0) {
        return {
          status: JobStatus.SUCCESS,
          message: "No active cities to update",
          executionTime: Date.now() - startTime,
          data: { citiesUpdated: 0 },
        };
      }

      logger.info(`Starting weather update for ${cities.length} cities`);

      let successCount = 0;
      let failureCount = 0;
      const errors: Array<{ city: string; error: string }> = [];

      // Process each city
      for (const city of cities) {
        try {
          // Fetch fresh weather data
          const weatherData = await weatherClient.getCurrentWeather(
            city.name,
            city.apiId || undefined,
            city.latitude || undefined,
            city.longitude || undefined
          );

          if (weatherData) {
            // Update cache
            await cacheService.setCachedWeather(city.id, weatherData);
            successCount++;
            logger.debug(`Updated weather for ${city.name}`);
          } else {
            failureCount++;
            errors.push({
              city: city.name,
              error: "No data returned from API",
            });
          }
        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          errors.push({
            city: city.name,
            error: errorMessage,
          });
          logger.error(`Failed to update weather for ${city.name}:`, error);
          // Continue with other cities even if one fails
        }

        // Add small delay to avoid rate limiting (OpenWeatherMap free tier: 60 calls/minute)
        // With 20 cities, we're well under the limit, but adding delay for safety
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const executionTime = Date.now() - startTime;
      const message = `Updated ${successCount}/${cities.length} cities`;

      if (failureCount > 0) {
        logger.warn(`Weather update completed with ${failureCount} failures: ${message}`);
      } else {
        logger.info(`Weather update completed successfully: ${message}`);
      }

      return {
        status: failureCount === 0 ? JobStatus.SUCCESS : JobStatus.FAILED,
        message,
        executionTime,
        data: {
          citiesUpdated: successCount,
          citiesFailed: failureCount,
          totalCities: cities.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error("Weather update job failed:", error);
      return {
        status: JobStatus.FAILED,
        message: `Job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
      };
    }
  },
};
