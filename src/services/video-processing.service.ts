import prisma from "@/config/prisma";
import { ProcessingStatus } from "@prisma/client";
import { extractVideoMetadata } from "@/lib/video-metadata";
import { ThumbnailService } from "./thumbnail.service";
import { logger } from "@/utils/logger";
import fs from "fs";
import path from "path";

const thumbnailService = new ThumbnailService();

/**
 * Video Processing Service
 * Handles video metadata extraction and thumbnail generation
 */
export class VideoProcessingService {
  /**
   * Process a video: extract metadata and generate thumbnail
   * @param mediaId - Media record ID
   */
  async processVideo(mediaId: string): Promise<void> {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: { uploader: true },
    });

    if (!media) {
      throw new Error(`Media not found: ${mediaId}`);
    }

    if (media.type !== "VIDEO") {
      throw new Error(`Media is not a video: ${mediaId}`);
    }

    // Check if uploader is admin/super-admin (can auto-approve)
    const canAutoApprove =
      media.uploader?.role === "ADMIN" || media.uploader?.role === "SUPER_ADMIN";

    // Update status to PROCESSING
    await prisma.media.update({
      where: { id: mediaId },
      data: { processingStatus: ProcessingStatus.PROCESSING },
    });

    try {
      // Get video file path - handle both absolute and relative URLs
      let relativePath = media.url;
      if (media.url.startsWith("http://") || media.url.startsWith("https://")) {
        // Extract path from absolute URL
        try {
          const urlObj = new URL(media.url);
          relativePath = urlObj.pathname;
        } catch {
          // If URL parsing fails, try to extract path manually
          const pathMatch = media.url.match(/\/uploads\/.*/);
          relativePath = pathMatch ? pathMatch[0] : media.url;
        }
      }
      
      const videoPath = path.join(
        process.cwd(),
        relativePath.startsWith("/") ? relativePath.slice(1) : relativePath
      );

      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Extract metadata
      logger.info(`Extracting metadata for video: ${mediaId}`);
      const metadata = await extractVideoMetadata(videoPath);

      // Generate thumbnail
      let thumbnailUrl: string | undefined;
      try {
        logger.info(`Generating thumbnail for video: ${mediaId}`);
        thumbnailUrl = await thumbnailService.generateThumbnailForVideo(videoPath, mediaId);
      } catch (error) {
        logger.warn(`Thumbnail generation failed for ${mediaId}:`, error);
        // Continue without thumbnail
      }

      // Update media record with metadata
      // For non-admin users, keep status as PENDING (requires admin approval)
      // For admin/super-admin, set to COMPLETED (auto-approved)
      await prisma.media.update({
        where: { id: mediaId },
        data: {
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          fileSize: BigInt(metadata.fileSize),
          thumbnailUrl,
          codec: metadata.codec,
          bitrate: metadata.bitrate,
          processingStatus: canAutoApprove ? ProcessingStatus.COMPLETED : ProcessingStatus.PENDING,
        },
      });

      logger.info(
        `Video processing completed for: ${mediaId} (status: ${canAutoApprove ? "COMPLETED" : "PENDING"})`
      );
    } catch (error) {
      // Update status to FAILED
      await prisma.media.update({
        where: { id: mediaId },
        data: {
          processingStatus: ProcessingStatus.FAILED,
        },
      });

      logger.error(`Video processing failed for ${mediaId}:`, error);
      throw error;
    }
  }

  /**
   * Process multiple videos (batch processing)
   */
  async processVideos(mediaIds: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const mediaId of mediaIds) {
      try {
        await this.processVideo(mediaId);
        success++;
      } catch (error) {
        failed++;
        logger.error(`Failed to process video ${mediaId}:`, error);
      }
    }

    return { success, failed };
  }

  /**
   * Get videos pending processing
   */
  async getPendingVideos(limit = 10) {
    return await prisma.media.findMany({
      where: {
        type: "VIDEO",
        processingStatus: {
          in: [ProcessingStatus.PENDING, ProcessingStatus.FAILED],
        },
      },
      take: limit,
      orderBy: { createdAt: "asc" },
    });
  }
}
