import { JobDefinition, JobStatus, JobResult } from "./types";
import { VideoProcessingService } from "@/services/video-processing.service";
import { logger } from "@/utils/logger";

const videoProcessingService = new VideoProcessingService();

/**
 * Video Processing Job
 * Processes pending videos (extracts metadata and generates thumbnails)
 * Runs every 5 minutes
 */
export const videoProcessingJob: JobDefinition = {
  name: "video-processing",
  schedule: "*/5 * * * *", // Every 5 minutes
  enabled: true,
  execute: async (): Promise<JobResult> => {
    const startTime = Date.now();

    try {
      // Get pending videos (limit to 5 per run to avoid overload)
      const pendingVideos = await videoProcessingService.getPendingVideos(5);

      if (pendingVideos.length === 0) {
        return {
          status: JobStatus.SUCCESS,
          message: "No pending videos to process",
          executionTime: Date.now() - startTime,
          data: { videosProcessed: 0 },
        };
      }

      logger.info(`Processing ${pendingVideos.length} pending video(s)`);

      const mediaIds = pendingVideos.map((v) => v.id);
      const result = await videoProcessingService.processVideos(mediaIds);

      const executionTime = Date.now() - startTime;
      const message = `Processed ${result.success}/${pendingVideos.length} video(s)`;

      if (result.failed > 0) {
        logger.warn(`Video processing completed with ${result.failed} failure(s): ${message}`);
      } else {
        logger.info(`Video processing completed successfully: ${message}`);
      }

      return {
        status: result.failed === 0 ? JobStatus.SUCCESS : JobStatus.FAILED,
        message,
        executionTime,
        data: {
          videosProcessed: result.success,
          videosFailed: result.failed,
          totalVideos: pendingVideos.length,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error("Video processing job failed:", error);
      return {
        status: JobStatus.FAILED,
        message: `Job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
      };
    }
  },
};
