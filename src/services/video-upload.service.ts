import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import env from "@/config/env";
import prisma from "@/config/prisma";
import { MediaService } from "./media.service";
import { VideoProcessingService } from "./video-processing.service";
import { logger } from "@/utils/logger";
import { getAbsoluteUrl } from "@/utils/url";

const mediaService = new MediaService();
const videoProcessingService = new VideoProcessingService();

// In-memory storage for upload sessions (in production, use Redis)
interface UploadSession {
  uploadId: string;
  filename: string;
  totalChunks: number;
  totalSize: number;
  chunks: Map<number, Buffer>;
  receivedChunks: Set<number>;
  createdAt: Date;
}

const uploadSessions = new Map<string, UploadSession>();
const CHUNK_STORAGE_DIR = path.join(process.cwd(), "uploads", "chunks");

// Ensure chunk storage directory exists
if (!fs.existsSync(CHUNK_STORAGE_DIR)) {
  fs.mkdirSync(CHUNK_STORAGE_DIR, { recursive: true });
}

/**
 * Video Upload Service
 * Handles chunked video uploads for large files
 */
export class VideoUploadService {
  /**
   * Initiate chunked upload
   */
  async initiateUpload(
    filename: string,
    totalChunks: number,
    totalSize: number
  ): Promise<{ uploadId: string }> {
    const uploadId = randomUUID();

    const session: UploadSession = {
      uploadId,
      filename,
      totalChunks,
      totalSize,
      chunks: new Map(),
      receivedChunks: new Set(),
      createdAt: new Date(),
    };

    uploadSessions.set(uploadId, session);

    // Clean up old sessions (older than 24 hours)
    this.cleanupOldSessions();

    return { uploadId };
  }

  /**
   * Upload a chunk
   */
  async uploadChunk(
    uploadId: string,
    chunkNumber: number,
    chunkData: Buffer,
    totalChunks: number
  ): Promise<{ received: number; total: number }> {
    const session = uploadSessions.get(uploadId);

    if (!session) {
      throw new Error("Upload session not found");
    }

    // Validate chunk number
    if (chunkNumber < 0 || chunkNumber >= totalChunks) {
      throw new Error(`Invalid chunk number: ${chunkNumber}`);
    }

    // Store chunk in memory (for small files) or file system (for large files)
    if (session.totalSize < 100 * 1024 * 1024) {
      // Store in memory for files < 100MB
      session.chunks.set(chunkNumber, chunkData);
    } else {
      // Store on disk for larger files
      const chunkPath = path.join(CHUNK_STORAGE_DIR, `${uploadId}-chunk-${chunkNumber}`);
      fs.writeFileSync(chunkPath, chunkData);
    }

    session.receivedChunks.add(chunkNumber);

    return {
      received: session.receivedChunks.size,
      total: totalChunks,
    };
  }

  /**
   * Complete upload and merge chunks
   */
  async completeUpload(
    uploadId: string,
    caption?: string,
    newsId?: string
  ): Promise<{ mediaId: string; url: string }> {
    const session = uploadSessions.get(uploadId);

    if (!session) {
      throw new Error("Upload session not found");
    }

    // Verify all chunks are received
    if (session.receivedChunks.size !== session.totalChunks) {
      throw new Error(
        `Missing chunks. Received: ${session.receivedChunks.size}, Expected: ${session.totalChunks}`
      );
    }

    // Generate final filename
    const fileExt = path.extname(session.filename);
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
    const videoUploadDir = env.VIDEO_UPLOAD_DIR || "uploads/videos";
    const finalPath = path.join(process.cwd(), videoUploadDir, uniqueFilename);

    // Ensure directory exists
    const finalDir = path.dirname(finalPath);
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    // Merge chunks
    logger.info(`Merging ${session.totalChunks} chunks for upload ${uploadId}`);
    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < session.totalChunks; i++) {
      if (session.totalSize < 100 * 1024 * 1024) {
        // Read from memory
        const chunk = session.chunks.get(i);
        if (!chunk) {
          throw new Error(`Chunk ${i} not found`);
        }
        writeStream.write(chunk);
      } else {
        // Read from disk
        const chunkPath = path.join(CHUNK_STORAGE_DIR, `${uploadId}-chunk-${i}`);
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Chunk file ${i} not found`);
        }
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        // Delete chunk file after reading
        fs.unlinkSync(chunkPath);
      }
    }

    writeStream.end();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", () => resolve());
      writeStream.on("error", (err) => reject(err));
    });

    // Create a mock file object for saveMedia
    // Note: saveMedia will generate the URL based on file type
    const mockFile: Express.Multer.File = {
      fieldname: "file",
      originalname: session.filename,
      encoding: "7bit",
      mimetype: "video/mp4", // Default, can be improved
      size: session.totalSize,
      filename: uniqueFilename,
      path: finalPath,
      buffer: Buffer.alloc(0), // Not needed since file is on disk
      destination: videoUploadDir,
    } as Express.Multer.File;

    const media = await mediaService.saveMedia(mockFile, caption, newsId);

    // Media service now saves absolute URLs, so no need to update
    // The URL is already absolute in the database

    // Clean up session
    uploadSessions.delete(uploadId);

    // Trigger video processing (async)
    videoProcessingService.processVideo(media.id).catch((error) => {
      logger.error(`Failed to process video ${media.id}:`, error);
    });

    return {
      mediaId: media.id,
      url: media.url, // Already absolute from saveMedia
    };
  }

  /**
   * Cancel upload and cleanup
   */
  async cancelUpload(uploadId: string): Promise<void> {
    const session = uploadSessions.get(uploadId);

    if (!session) {
      throw new Error("Upload session not found");
    }

    // Delete chunk files if stored on disk
    if (session.totalSize >= 100 * 1024 * 1024) {
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(CHUNK_STORAGE_DIR, `${uploadId}-chunk-${i}`);
        if (fs.existsSync(chunkPath)) {
          try {
            fs.unlinkSync(chunkPath);
          } catch (error) {
            logger.warn(`Failed to delete chunk ${i} for upload ${uploadId}:`, error);
          }
        }
      }
    }

    // Remove session
    uploadSessions.delete(uploadId);
  }

  /**
   * Get upload progress
   */
  getUploadProgress(
    uploadId: string
  ): { received: number; total: number; percentage: number } | null {
    const session = uploadSessions.get(uploadId);

    if (!session) {
      return null;
    }

    return {
      received: session.receivedChunks.size,
      total: session.totalChunks,
      percentage: Math.round((session.receivedChunks.size / session.totalChunks) * 100),
    };
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [uploadId, session] of uploadSessions.entries()) {
      const age = now - session.createdAt.getTime();
      if (age > maxAge) {
        logger.info(`Cleaning up old upload session: ${uploadId}`);
        this.cancelUpload(uploadId).catch((error) => {
          logger.error(`Error cleaning up session ${uploadId}:`, error);
        });
      }
    }
  }
}
