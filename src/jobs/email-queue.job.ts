import { JobDefinition, JobStatus, JobResult } from "./types";
import { emailQueueService } from "@/services/email-queue.service";
import { logger } from "@/utils/logger";

/**
 * Email Queue Processing Job
 * Processes pending emails from the queue
 * Runs every 2 minutes
 */
export const emailQueueJob: JobDefinition = {
  name: "email-queue",
  schedule: "*/2 * * * *", // Every 2 minutes
  enabled: true,
  execute: async (): Promise<JobResult> => {
    const startTime = Date.now();

    try {
      const result = await emailQueueService.processQueue(50);

      const executionTime = Date.now() - startTime;

      if (result.processed === 0) {
        return {
          status: JobStatus.SUCCESS,
          message: "No pending emails to process",
          executionTime,
          data: result,
        };
      }

      if (result.failed > 0) {
        logger.warn(
          `Email queue job completed with ${result.failed} failure(s): ${result.succeeded} succeeded, ${result.failed} failed`
        );
        return {
          status: JobStatus.FAILED,
          message: `Processed ${result.processed} email(s): ${result.succeeded} succeeded, ${result.failed} failed`,
          executionTime,
          data: result,
        };
      }

      logger.info(`Email queue job completed successfully: ${result.succeeded} email(s) sent`);

      return {
        status: JobStatus.SUCCESS,
        message: `Processed ${result.processed} email(s) successfully`,
        executionTime,
        data: result,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error("Email queue job error:", error);

      return {
        status: JobStatus.FAILED,
        message: `Error processing email queue: ${error instanceof Error ? error.message : "Unknown error"}`,
        executionTime,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },
};
