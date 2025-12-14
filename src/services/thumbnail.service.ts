import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import env from "@/config/env";
import { extractVideoMetadata } from "@/lib/video-metadata";

const execAsync = promisify(exec);

/**
 * Thumbnail Generation Service
 * Generates thumbnails from video files using FFmpeg
 */
export class ThumbnailService {
  /**
   * Generate thumbnail from video
   * @param videoPath - Path to video file
   * @param outputPath - Path where thumbnail should be saved
   * @param timeOffset - Time offset in seconds (default: 10% of duration or 1 second)
   */
  async generateThumbnail(
    videoPath: string,
    outputPath: string,
    timeOffset?: number
  ): Promise<string> {
    // Ensure thumbnail directory exists
    const thumbnailDir = path.dirname(outputPath);
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    // If timeOffset not provided, try to get it from video duration
    let seekTime = timeOffset;
    if (!seekTime) {
      try {
        const metadata = await extractVideoMetadata(videoPath);
        // Use 10% of duration or 1 second, whichever is smaller
        seekTime = metadata.duration > 0 ? Math.min(metadata.duration * 0.1, 1) : 1;
      } catch {
        // Fallback to 1 second if metadata extraction fails
        seekTime = 1;
      }
    }

    const ffmpegPath = env.FFMPEG_PATH ? path.join(env.FFMPEG_PATH, "ffmpeg") : "ffmpeg";

    try {
      // Generate thumbnail using FFmpeg
      // -ss: seek to time offset
      // -i: input file
      // -vframes 1: extract only 1 frame
      // -q:v 2: high quality JPEG
      // -y: overwrite output file
      const command = `"${ffmpegPath}" -ss ${seekTime} -i "${videoPath}" -vframes 1 -q:v 2 -y "${outputPath}"`;

      await execAsync(command);

      // Verify thumbnail was created
      if (fs.existsSync(outputPath)) {
        return outputPath;
      } else {
        throw new Error("Thumbnail file was not created");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error generating thumbnail: ${errorMessage}`);
      throw new Error(`Failed to generate thumbnail: ${errorMessage}`);
    }
  }

  /**
   * Generate thumbnail and return relative URL
   * @param videoPath - Path to video file
   * @param videoId - Media ID for naming
   */
  async generateThumbnailForVideo(videoPath: string, videoId: string): Promise<string> {
    const thumbnailDir = env.THUMBNAIL_DIR || "uploads/thumbnails";
    const thumbnailFilename = `${videoId}-thumb.jpg`;
    const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
    const absolutePath = path.join(process.cwd(), thumbnailPath);

    await this.generateThumbnail(videoPath, absolutePath);

    // Return relative URL
    return `/${thumbnailPath.replace(/\\/g, "/")}`;
  }

  /**
   * Generate multiple thumbnail sizes (optional)
   */
  async generateMultipleSizes(
    videoPath: string,
    videoId: string,
    sizes: Array<{ width: number; height: number; suffix: string }>
  ): Promise<string[]> {
    const thumbnailDir = env.THUMBNAIL_DIR || "uploads/thumbnails";
    const urls: string[] = [];

    for (const size of sizes) {
      const thumbnailFilename = `${videoId}-thumb-${size.suffix}.jpg`;
      const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
      const absolutePath = path.join(process.cwd(), thumbnailPath);

      const ffmpegPath = env.FFMPEG_PATH ? path.join(env.FFMPEG_PATH, "ffmpeg") : "ffmpeg";

      try {
        // Extract frame and resize
        const seekTime = 1; // Use 1 second as default
        const command = `"${ffmpegPath}" -ss ${seekTime} -i "${videoPath}" -vframes 1 -vf "scale=${size.width}:${size.height}" -q:v 2 -y "${absolutePath}"`;

        await execAsync(command);

        if (fs.existsSync(absolutePath)) {
          urls.push(`/${thumbnailPath.replace(/\\/g, "/")}`);
        }
      } catch (error) {
        console.error(`Error generating thumbnail size ${size.suffix}:`, error);
        // Continue with other sizes
      }
    }

    return urls;
  }
}
