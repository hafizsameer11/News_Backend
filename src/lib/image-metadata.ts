import fs from "fs";
import sharp from "sharp";

export interface ImageMetadata {
  width: number; // pixels
  height: number; // pixels
  fileSize: number; // bytes
}

/**
 * Extract image metadata using sharp
 * Falls back to basic file size if sharp fails
 */
export async function extractImageMetadata(filePath: string): Promise<ImageMetadata> {
  // Get file size (always available)
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;

  try {
    // Use sharp to get image metadata
    const metadata = await sharp(filePath).metadata();

    if (metadata.width && metadata.height) {
      return {
        width: metadata.width,
        height: metadata.height,
        fileSize,
      };
    }
  } catch (error) {
    // Sharp failed or image is corrupted - fallback to basic metadata
    console.warn(
      `Error extracting image metadata: ${error instanceof Error ? error.message : String(error)}`
    );
    console.warn("Falling back to basic file size metadata");
  }

  // Fallback: return basic metadata with file size only
  return {
    width: 0,
    height: 0,
    fileSize,
  };
}
