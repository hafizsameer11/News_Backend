import { Router } from "express";
import { reportController } from "@/controllers/report.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard, optionalAuth } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import { validate } from "@/middleware/validate";
import { z } from "zod";

const router = Router();

const createReportValidator = z.object({
  body: z.object({
    content: z.string().min(10),
    mediaUrl: z.string().url().optional().or(z.literal("")),
    contactInfo: z.string().optional(),
  }),
});

// Public (Optional Auth) - Submit Report
// Uses optionalAuth to capture user ID if token is present
router.post(
  "/",
  optionalAuth(),
  validate(createReportValidator),
  asyncHandler(reportController.create)
);

// Admin - View & Resolve
router.use(authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]));

router.get("/", asyncHandler(reportController.getAll));
router.patch("/:id/resolve", asyncHandler(reportController.resolve));

export default router;
