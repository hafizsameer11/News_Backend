import { JobDefinition, JobStatus, JobResult } from "./types";
import { HoroscopeService } from "@/services/horoscope.service";
import { logger } from "@/utils/logger";

/**
 * Daily Horoscope Ingestion Job
 * Runs daily at midnight (00:00) to ingest horoscope content for all signs
 */
export const horoscopeDailyJob: JobDefinition = {
  name: "horoscope-daily",
  schedule: "0 0 * * *", // Daily at midnight
  enabled: true,
  execute: async (): Promise<JobResult> => {
    const startTime = Date.now();
    const horoscopeService = new HoroscopeService();

    try {
      logger.info("Starting daily horoscope ingestion job");

      const result = await horoscopeService.ingestDailyHoroscope();

      const executionTime = Date.now() - startTime;
      const message = `Ingested ${result.success} daily horoscopes, ${result.failed} failed`;

      if (result.failed > 0) {
        logger.warn(`Daily horoscope ingestion completed with errors: ${message}`);
        return {
          status: JobStatus.FAILED,
          message,
          executionTime,
          data: result,
        };
      }

      logger.info(`Daily horoscope ingestion completed successfully: ${message}`);
      return {
        status: JobStatus.SUCCESS,
        message,
        executionTime,
        data: result,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error("Daily horoscope ingestion job failed:", error);
      return {
        status: JobStatus.FAILED,
        message: `Job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
      };
    }
  },
};

/**
 * Weekly Horoscope Ingestion Job
 * Runs weekly on Monday at midnight (00:00) to ingest weekly horoscope content
 */
export const horoscopeWeeklyJob: JobDefinition = {
  name: "horoscope-weekly",
  schedule: "0 0 * * 1", // Every Monday at midnight
  enabled: true,
  execute: async (): Promise<JobResult> => {
    const startTime = Date.now();
    const horoscopeService = new HoroscopeService();

    try {
      logger.info("Starting weekly horoscope ingestion job");

      const result = await horoscopeService.ingestWeeklyHoroscope();

      const executionTime = Date.now() - startTime;
      const message = `Ingested ${result.success} weekly horoscopes, ${result.failed} failed`;

      if (result.failed > 0) {
        logger.warn(`Weekly horoscope ingestion completed with errors: ${message}`);
        return {
          status: JobStatus.FAILED,
          message,
          executionTime,
          data: result,
        };
      }

      logger.info(`Weekly horoscope ingestion completed successfully: ${message}`);
      return {
        status: JobStatus.SUCCESS,
        message,
        executionTime,
        data: result,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error("Weekly horoscope ingestion job failed:", error);
      return {
        status: JobStatus.FAILED,
        message: `Job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
      };
    }
  },
};
