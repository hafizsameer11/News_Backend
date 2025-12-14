import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import env from "@/config/env";

const execAsync = promisify(exec);

export interface VideoMetadata {
  duration: number; // seconds
  width: number; // pixels
  height: number; // pixels
  fileSize: number; // bytes
  codec?: string; // e.g., "h264", "vp9"
  bitrate?: number; // kbps
}

/**
 * Extract video metadata using ffprobe (FFmpeg)
 * Falls back to basic file size if FFmpeg is not available
 */
export async function extractVideoMetadata(filePath: string): Promise<VideoMetadata> {
  // Get file size (always available)
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;

  // Try to use ffprobe if available
  const ffprobePath = env.FFMPEG_PATH ? path.join(env.FFMPEG_PATH, "ffprobe") : "ffprobe"; // Try system PATH

  try {
    // Use ffprobe to get video metadata
    const { stdout } = await execAsync(
      `"${ffprobePath}" -v error -show_entries stream=width,height,codec_name,bit_rate -show_entries format=duration -of json "${filePath}"`
    );

    const metadata = JSON.parse(stdout);
    const videoStream = metadata.streams?.find((s: any) => s.codec_name);
    const format = metadata.format;

    if (videoStream && format) {
      const duration = parseFloat(format.duration || "0");
      const width = parseInt(videoStream.width || "0", 10);
      const height = parseInt(videoStream.height || "0", 10);
      const codec = videoStream.codec_name || undefined;
      const bitrate = videoStream.bit_rate
        ? Math.round(parseInt(videoStream.bit_rate, 10) / 1000) // Convert to kbps
        : undefined;

      return {
        duration: Math.round(duration),
        width,
        height,
        fileSize,
        codec,
        bitrate,
      };
    }
  } catch (error) {
    // FFmpeg not available or error - fallback to basic metadata
    console.warn(
      `FFmpeg not available or error extracting metadata: ${error instanceof Error ? error.message : String(error)}`
    );
    console.warn("Falling back to basic file size metadata");
  }

  // Fallback: return basic metadata with file size only
  return {
    duration: 0,
    width: 0,
    height: 0,
    fileSize,
    codec: undefined,
    bitrate: undefined,
  };
}

/**
 * Check if FFmpeg is available
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  const ffprobePath = env.FFMPEG_PATH ? path.join(env.FFMPEG_PATH, "ffprobe") : "ffprobe";

  try {
    await execAsync(`"${ffprobePath}" -version`);
    return true;
  } catch {
    return false;
  }
}
