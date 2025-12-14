import express, { Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import env from "@/config/env";
import routes from "@/routes";
import { errorHandler } from "@/middleware/errorHandler";
import { auditLogMiddleware } from "@/middleware/auditLog.middleware";
import { logger } from "@/utils/logger";
import { swaggerSpec } from "@/config/swagger";

/**
 * Create and configure Express application
 */
export const createApp = (): Express => {
  const app = express();

  // Security middleware (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", "*"],
          styleSrc: ["'self'", "'unsafe-inline'", "*"],
          scriptSrc: ["'self'", "'unsafe-inline'", "*"],
          imgSrc: ["'self'", "data:", "https:", "*"],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow embedding for Swagger UI
      crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
    })
  );

  // Compression middleware
  app.use(compression());

  // CORS configuration - allow all origins
  app.use(
    cors({
      origin: true, // Allow all origins
      credentials: true,
    })
  );

  // Documentation
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  logger.info(`📄 Swagger Docs available at http://localhost:${env.PORT}/api-docs`);

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
  });
  app.use("/api/v1/", limiter);

  // Webhook routes must be before JSON parser (handles raw body)
  app.use("/api/v1/payment/webhook", express.raw({ type: "application/json" }));
  app.use("/api/v1/social/webhook", express.raw({ type: "application/json" }));

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging (skip verbose analytics tracking logs)
  app.use((req, _res, next) => {
    // Don't log analytics tracking requests to reduce console noise
    if (req.path.includes("/analytics/track")) {
      // Only log in development if PRISMA_DEBUG is enabled
      if (process.env.PRISMA_DEBUG === "true") {
        logger.debug(`${req.method} ${req.path}`);
      }
    } else {
      logger.info(`${req.method} ${req.path}`);
    }
    next();
  });

  // Audit logging middleware (must be after body parser, before routes)
  // This will log authenticated admin/editor actions
  app.use(auditLogMiddleware);

  // CORS middleware for static uploads (must be before static file serving)
  app.use(
    "/uploads",
    cors({
      origin: true, // Allow all origins
      credentials: true,
    })
  );

  // Override Cross-Origin-Resource-Policy for static files (Helmet sets it to "same-origin" by default)
  app.use("/uploads", (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  });

  // Serve static uploads (before API routes to avoid versioning)
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // API routes (versioned)
  app.use("/api/v1", routes);

  // Root endpoint
  app.get("/", (_req, res) => {
    res.json({
      message: "NEWS NEXT Backend API",
      version: "1.0.0",
      status: "running",
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
};
