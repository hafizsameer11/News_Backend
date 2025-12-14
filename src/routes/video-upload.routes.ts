import { Router } from "express";
import { videoUploadController } from "@/controllers/video-upload.controller";
import { chunkUpload } from "@/config/multer";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import {
  initiateUploadValidator,
  uploadChunkValidator,
  completeUploadValidator,
  cancelUploadValidator,
  getProgressValidator,
} from "@/validators/video-upload.validators";

const router = Router();

// Protect all video upload routes
router.use(authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.EDITOR]));

/**
 * @openapi
 * /video/upload/initiate:
 *   post:
 *     tags:
 *       - Video Upload
 *     summary: Initiate chunked video upload
 *     description: Initialize a new chunked upload session. Returns uploadId for subsequent chunk uploads.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filename
 *               - totalChunks
 *               - totalSize
 *             properties:
 *               filename:
 *                 type: string
 *                 example: "video.mp4"
 *               totalChunks:
 *                 type: integer
 *                 example: 20
 *               totalSize:
 *                 type: integer
 *                 example: 104857600
 *     responses:
 *       201:
 *         description: Upload session initiated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/initiate",
  validate(initiateUploadValidator),
  asyncHandler(videoUploadController.initiate)
);

/**
 * @openapi
 * /video/upload/chunk:
 *   post:
 *     tags:
 *       - Video Upload
 *     summary: Upload a chunk
 *     description: Upload a single chunk of the video file. Chunks should be uploaded in order.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - uploadId
 *               - chunkNumber
 *               - totalChunks
 *               - chunk
 *             properties:
 *               uploadId:
 *                 type: string
 *                 format: uuid
 *               chunkNumber:
 *                 type: integer
 *               totalChunks:
 *                 type: integer
 *               chunk:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Chunk uploaded successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/chunk",
  chunkUpload.single("chunk"),
  validate(uploadChunkValidator),
  asyncHandler(videoUploadController.uploadChunk)
);

/**
 * @openapi
 * /video/upload/complete:
 *   post:
 *     tags:
 *       - Video Upload
 *     summary: Complete chunked upload
 *     description: Merge all chunks and create media record. Triggers video processing.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uploadId
 *             properties:
 *               uploadId:
 *                 type: string
 *                 format: uuid
 *               caption:
 *                 type: string
 *               newsId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Upload completed and media created
 *       400:
 *         description: Validation error or missing chunks
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/complete",
  validate(completeUploadValidator),
  asyncHandler(videoUploadController.complete)
);

/**
 * @openapi
 * /video/upload/cancel:
 *   post:
 *     tags:
 *       - Video Upload
 *     summary: Cancel chunked upload
 *     description: Cancel an ongoing upload and cleanup chunks.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uploadId
 *             properties:
 *               uploadId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Upload cancelled
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/cancel", validate(cancelUploadValidator), asyncHandler(videoUploadController.cancel));

/**
 * @openapi
 * /video/upload/progress/{uploadId}:
 *   get:
 *     tags:
 *       - Video Upload
 *     summary: Get upload progress
 *     description: Get the progress of an ongoing chunked upload.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uploadId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Upload progress retrieved
 *       404:
 *         description: Upload session not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/progress/:uploadId",
  validate(getProgressValidator),
  asyncHandler(videoUploadController.getProgress)
);

export default router;
