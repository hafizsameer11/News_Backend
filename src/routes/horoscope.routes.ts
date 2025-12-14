import { Router } from "express";
import { horoscopeController } from "@/controllers/horoscope.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";

const router = Router();

// Public
router.get("/daily", asyncHandler(horoscopeController.getDaily));
router.get("/:sign", asyncHandler(horoscopeController.getSign));

// Admin
router.post(
  "/",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(horoscopeController.upsert)
);

export default router;
