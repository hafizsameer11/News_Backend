import { JobDefinition, JobStatus, JobResult } from "./types";
import prisma from "@/config/prisma";
import { logger } from "@/utils/logger";

/**
 * Ad Expiration Job
 * Automatically marks expired ads (endDate < NOW) as EXPIRED
 * Runs daily at midnight (Europe/Rome timezone)
 */
export const adExpirationJob: JobDefinition = {
  name: "ad-expiration",
  schedule: "0 0 * * *", // Daily at midnight
  enabled: true,
  execute: async (): Promise<JobResult> => {
    const startTime = Date.now();

    try {
      const now = new Date();

      // Find all ads that have expired but are still ACTIVE or PAUSED
      const expiredAds = await prisma.ad.findMany({
        where: {
          endDate: { lt: now },
          status: {
            in: ["ACTIVE", "PAUSED"],
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          endDate: true,
        },
      });

      if (expiredAds.length === 0) {
        return {
          status: JobStatus.SUCCESS,
          message: "No expired ads to update",
          executionTime: Date.now() - startTime,
          data: { adsExpired: 0 },
        };
      }

      logger.info(`Found ${expiredAds.length} expired ads to update`);

      // Update all expired ads to EXPIRED status
      const updateResult = await prisma.ad.updateMany({
        where: {
          id: { in: expiredAds.map((ad) => ad.id) },
        },
        data: {
          status: "EXPIRED",
        },
      });

      const executionTime = Date.now() - startTime;
      const message = `Marked ${updateResult.count} ads as expired`;

      logger.info(`Ad expiration job completed: ${message}`);

      return {
        status: JobStatus.SUCCESS,
        message,
        executionTime,
        data: {
          adsExpired: updateResult.count,
          totalFound: expiredAds.length,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error("Ad expiration job failed:", error);
      return {
        status: JobStatus.FAILED,
        message: `Job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
      };
    }
  },
};
