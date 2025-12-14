import prisma from "@/config/prisma";
import { MediaType } from "@prisma/client";
import path from "path";
import fs from "fs";
import { extractImageMetadata } from "@/lib/image-metadata";
import { VideoProcessingService } from "./video-processing.service";
import { logger } from "@/utils/logger";

const videoProcessingService = new VideoProcessingService();

export class MediaService {
  /**
   * Save media record to DB
   */
  async saveMedia(
    file: Express.Multer.File,
    caption?: string,
    newsId?: string,
    uploaderId?: string,
    uploaderRole?: string
  ) {
    const type = file.mimetype.startsWith("video") ? MediaType.VIDEO : MediaType.IMAGE;

    // Determine URL based on file type
    const url =
      type === MediaType.VIDEO ? `/uploads/videos/${file.filename}` : `/uploads/${file.filename}`;

    // Base data object
    const data: any = {
      url,
      type,
      caption,
      newsId,
      uploaderId,
    };

    // Determine processing status based on user role and media type
    // Only Admins and Super Admins can auto-approve, others need approval
    const canAutoApprove = uploaderRole === "ADMIN" || uploaderRole === "SUPER_ADMIN";

    if (type === MediaType.VIDEO) {
      // For videos, set processing status to PENDING (always needs processing)
      data.processingStatus = "PENDING";
      data.fileSize = BigInt(file.size);
    } else if (type === MediaType.IMAGE) {
      // For images, extract metadata (width, height, fileSize)
      // Set status: COMPLETED for admins/super-admins, PENDING for others (editors, advertisers, users)
      data.processingStatus = canAutoApprove ? "COMPLETED" : "PENDING";
      try {
        const filePath = path.join(process.cwd(), url.startsWith("/") ? url.slice(1) : url);
        const metadata = await extractImageMetadata(filePath);

        data.width = metadata.width > 0 ? metadata.width : null;
        data.height = metadata.height > 0 ? metadata.height : null;
        data.fileSize = BigInt(metadata.fileSize);
      } catch (error) {
        // If metadata extraction fails, still save the media but without dimensions
        console.warn(
          `Failed to extract image metadata: ${error instanceof Error ? error.message : String(error)}`
        );
        data.fileSize = BigInt(file.size);
      }
    }

    const media = await prisma.media.create({
      data,
    });

    // Trigger video processing asynchronously for videos (don't block upload response)
    if (type === MediaType.VIDEO) {
      videoProcessingService.processVideo(media.id).catch((error) => {
        logger.error(`Failed to process video ${media.id}:`, error);
        // Don't throw - upload succeeded, processing can fail without breaking the upload
      });
    }

    return media;
  }

  /**
   * Get all media
   * @param page - Page number
   * @param limit - Items per page
   * @param userId - User ID for filtering (if provided, only returns media uploaded by this user unless user is admin)
   * @param userRole - User role (ADMIN/SUPER_ADMIN can see all media)
   */
  async getAllMedia(page = 1, limit = 20, userId?: string, userRole?: string) {
    const skip = (page - 1) * limit;

    // Build where clause: admins see all, others see only their own
    // Also filter out FAILED media (rejected images) from public view
    // Authenticated users can see their own FAILED media, but not others' FAILED media
    const where: any = {};
    if (userId && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      // Non-admin authenticated users see only their own media
      // They can see their own FAILED media (to know what was rejected)
      where.uploaderId = userId;
    } else if (!userId) {
      // Public/unauthenticated users should not see FAILED media at all
      where.processingStatus = {
        not: "FAILED",
      };
    }
    // Admins can see all media including FAILED

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.media.count({ where }),
    ]);

    return {
      media,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get media by ID
   */
  async getMediaById(id: string) {
    return await prisma.media.findUnique({ where: { id } });
  }

  /**
   * Get media by URL (handles both relative and full URLs)
   */
  async getMediaByUrl(url: string) {
    // Extract relative path from full URL if needed
    let relativeUrl = url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        const urlObj = new URL(url);
        relativeUrl = urlObj.pathname;
      } catch {
        // If URL parsing fails, use original URL
        relativeUrl = url;
      }
    }

    return await prisma.media.findFirst({
      where: {
        OR: [{ url: relativeUrl }, { url: url }],
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Validate media URL - check if URL belongs to a media record and if it's approved
   * @param url - Media URL to validate
   * @param _userId - User ID (optional, for permission checks - currently unused)
   * @param userRole - User role (optional, admins can use any media)
   * @returns Validation result with isValid flag and error message if invalid
   */
  async validateMediaUrl(
    url: string,
    _userId?: string,
    userRole?: string
  ): Promise<{ isValid: boolean; error?: string }> {
    if (!url) {
      return { isValid: true }; // Empty URL is allowed (optional field)
    }

    // Extract relative path from full URL if needed
    let relativeUrl = url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      // Extract path from full URL (e.g., http://localhost:3001/uploads/image.png -> /uploads/image.png)
      try {
        const urlObj = new URL(url);
        relativeUrl = urlObj.pathname;
      } catch {
        // If URL parsing fails, treat as external URL
        return { isValid: true };
      }
    }

    // Check if URL is from our media library (starts with /uploads/)
    if (!relativeUrl.startsWith("/uploads/")) {
      // External URLs are allowed (not from our media library)
      return { isValid: true };
    }

    // Find media record by URL (try both relative and full URL)
    const media = await prisma.media.findFirst({
      where: {
        OR: [{ url: relativeUrl }, { url: url }],
      },
    });

    if (!media) {
      // URL not found in media library - might be external or old URL, allow it
      return { isValid: true };
    }

    // Check if media is FAILED (rejected)
    if (media.processingStatus === "FAILED") {
      return {
        isValid: false,
        error: "Cannot use rejected media. Please select an approved image.",
      };
    }

    // Check if media is PENDING and user is not admin
    if (
      media.processingStatus === "PENDING" &&
      userRole !== "ADMIN" &&
      userRole !== "SUPER_ADMIN"
    ) {
      return {
        isValid: false,
        error:
          "Cannot use pending media. Please wait for admin approval or select an approved image.",
      };
    }

    // Media is valid (COMPLETED or user is admin)
    return { isValid: true };
  }

  /**
   * Get videos by type
   */
  async getVideosByType(query: any) {
    const { page = 1, limit = 20, type } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      type: "VIDEO",
    };

    if (type) {
      // Additional filtering if needed
    }

    const [videos, total] = await Promise.all([
      prisma.media.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.media.count({ where }),
    ]);

    return {
      videos,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Update media processing status
   */
  async updateProcessingStatus(
    id: string,
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  ) {
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) throw new Error("Media not found");

    return await prisma.media.update({
      where: { id },
      data: { processingStatus: status },
    });
  }

  /**
   * Check if user can delete media
   * Admins/Editors can delete any media, others can only delete their own
   */
  async canUserDeleteMedia(mediaId: string, userId?: string, userRole?: string): Promise<boolean> {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return false;

    // Admins and editors can delete any media
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "EDITOR") {
      return true;
    }

    // Others can only delete their own media
    if (userId && media.uploaderId === userId) {
      return true;
    }

    return false;
  }

  /**
   * Delete media (with file cleanup)
   */
  async deleteMedia(id: string) {
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) throw new Error("Media not found");

    // Delete actual file from filesystem
    try {
      // Delete main file
      const filePath = path.join(
        process.cwd(),
        media.url.startsWith("/") ? media.url.slice(1) : media.url
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete thumbnail if exists
      if (media.thumbnailUrl) {
        const thumbnailPath = path.join(
          process.cwd(),
          media.thumbnailUrl.startsWith("/") ? media.thumbnailUrl.slice(1) : media.thumbnailUrl
        );
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }
    } catch (error) {
      // Log error but continue with database deletion
      console.error(`Error deleting file for media ${id}:`, error);
    }

    return await prisma.media.delete({ where: { id } });
  }
}
