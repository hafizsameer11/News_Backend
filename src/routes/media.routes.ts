import { Router } from "express";
import { mediaController } from "@/controllers/media.controller";
import { upload } from "@/config/multer";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";

const router = Router();

// Upload and list routes - allow ADVERTISER, ADMIN, SUPER_ADMIN, EDITOR
router.post(
  "/upload",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.EDITOR, ROLE.ADVERTISER]),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        // Handle multer errors (file type, file size, etc.)
        let statusCode = 400;
        let errorMessage = "File upload error";

        if (err instanceof Error) {
          errorMessage = err.message;
          
          // Handle specific multer error codes
          if ("code" in err) {
            switch (err.code) {
              case "LIMIT_FILE_SIZE":
                statusCode = 413;
                errorMessage = "File too large. Maximum size is 1GB.";
                break;
              case "LIMIT_FILE_COUNT":
                errorMessage = "Too many files. Only one file allowed.";
                break;
              case "LIMIT_UNEXPECTED_FILE":
                errorMessage = "Unexpected file field. Use 'file' as the field name.";
                break;
            }
          }
        }

        return res.status(statusCode).json({
          success: false,
          message: errorMessage,
          data: null,
        });
      }
      return next();
    });
  },
  asyncHandler(mediaController.upload)
);

router.get(
  "/",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.EDITOR, ROLE.ADVERTISER]),
  asyncHandler(mediaController.getAll)
);

// Update status route - admin/editor only
router.patch(
  "/:id/status",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.EDITOR]),
  asyncHandler(mediaController.updateStatus)
);

// Delete route - admin/editor can delete any, advertiser can delete their own
router.delete(
  "/:id",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.EDITOR, ROLE.ADVERTISER]),
  asyncHandler(mediaController.delete)
);

/**
 * @openapi
 * /media/{id}/stream:
 *   get:
 *     tags:
 *       - Media
 *     summary: Stream video with range support
 *     description: Stream video file with HTTP range request support for video seeking. Returns 206 Partial Content for range requests.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Full video file
 *         headers:
 *           Content-Length:
 *             schema:
 *               type: integer
 *           Accept-Ranges:
 *             schema:
 *               type: string
 *               example: bytes
 *       206:
 *         description: Partial video content (range request)
 *         headers:
 *           Content-Range:
 *             schema:
 *               type: string
 *               example: bytes 0-1023/1048576
 *           Content-Length:
 *             schema:
 *               type: integer
 *       404:
 *         description: Video not found
 */
// Public video streaming route (no auth required for video playback)
router.get("/:id/stream", asyncHandler(mediaController.streamVideo));

// Check media status by URL (public endpoint for frontend validation)
router.get("/check-status", asyncHandler(mediaController.checkStatus));

export default router;
