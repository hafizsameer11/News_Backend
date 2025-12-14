import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";
import env from "./env";

// Ensure uploads directories exist
const uploadDir = "uploads";
const videoUploadDir = env.VIDEO_UPLOAD_DIR || "uploads/videos";
const thumbnailDir = env.THUMBNAIL_DIR || "uploads/thumbnails";

[uploadDir, videoUploadDir, thumbnailDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Standard storage for images and small files
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    // Route videos to video directory, images to main uploads
    if (file.mimetype.startsWith("video/")) {
      cb(null, videoUploadDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Memory storage for chunked uploads
export const memoryStorage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed image types (including modern formats)
  const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/heic",
    "image/heif",
  ];

  // Allowed video types
  const allowedVideoTypes = [
    "video/mp4",
    "video/webm",
    "video/quicktime", // .mov
    "video/x-msvideo", // .avi
    "video/x-matroska", // .mkv
  ];

  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed: images (${allowedImageTypes.join(", ")}) and videos (${allowedVideoTypes.join(", ")})`
      )
    );
  }
};

// Standard upload (for images and small videos)
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for standard uploads
  },
});

// Video upload with larger size limit
export const videoUpload = multer({
  storage: storage,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Only allow video files
    const allowedVideoTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
    ];

    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only video files are allowed."));
    }
  },
  limits: {
    fileSize: env.MAX_VIDEO_SIZE || 1073741824, // 1GB default
  },
});

// Chunk upload (memory storage)
export const chunkUpload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: env.VIDEO_CHUNK_SIZE || 5242880, // 5MB per chunk
  },
});
