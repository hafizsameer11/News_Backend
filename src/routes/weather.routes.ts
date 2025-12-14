import { Router } from "express";
import { weatherController } from "@/controllers/weather.controller";
import { asyncHandler } from "@/middleware/asyncHandler";
import { authGuard } from "@/middleware/authGuard";
import { ROLE } from "@/types/enums";

const router = Router();

// Public
router.get("/cities", asyncHandler(weatherController.getAllCities));
// Support both query parameter (?cityId=...) and path parameter (/:id)
// Handle query parameter first (when no path parameter is present)
router.get("/", asyncHandler(weatherController.getCityWeather));
// Handle path parameter (/:id)
router.get("/:id", asyncHandler(weatherController.getCityWeather));

// Admin
router.post(
  "/seed",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(weatherController.seed)
);

router.post(
  "/cities",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(weatherController.addCity)
);

router.delete(
  "/cities/:id",
  authGuard([ROLE.ADMIN, ROLE.SUPER_ADMIN]),
  asyncHandler(weatherController.removeCity)
);

export default router;
