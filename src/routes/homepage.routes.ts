import { Router } from "express";
import { homepageController } from "@/controllers/homepage.controller";
import { validate } from "@/middleware/validate";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";
import {
  createHomepageSectionValidator,
  updateHomepageSectionValidator,
  reorderSectionsValidator,
} from "@/validators/homepage.validators";

const router = Router();

// Public: Get active layout
router.get("/layout", asyncHandler(homepageController.getActiveLayout));

// Admin only routes
router.use(authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]));

router.get("/sections", asyncHandler(homepageController.getAll));
router.get("/sections/:id", asyncHandler(homepageController.getOne));
router.post(
  "/sections",
  validate(createHomepageSectionValidator),
  asyncHandler(homepageController.create)
);
router.patch(
  "/sections/:id",
  validate(updateHomepageSectionValidator),
  asyncHandler(homepageController.update)
);
router.delete("/sections/:id", asyncHandler(homepageController.delete));
router.patch(
  "/sections/reorder",
  validate(reorderSectionsValidator),
  asyncHandler(homepageController.reorder)
);

export default router;
