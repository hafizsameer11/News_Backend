import express, { Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
// import helmet from "helmet"; // Disabled to avoid CORS conflicts
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

  // CORS MUST be first - before any other middleware
  // CORS configuration - allow all origins
  // When credentials: true, we must reflect the specific origin, not use "*"
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }
        // Allow all origins
        callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "X-CSRF-Token",
        "Cache-Control",
        "Pragma",
      ],
      exposedHeaders: ["Content-Range", "X-Content-Range", "Content-Length"],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 86400, // 24 hours
    })
  );

  // Global CORS headers middleware - ensure all responses have CORS headers (before Helmet)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    } else {
      // For requests without origin (like same-origin, Postman, etc.)
      res.header("Access-Control-Allow-Origin", "*");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, Cache-Control, Pragma"
    );
    res.header("Access-Control-Expose-Headers", "Content-Range, X-Content-Range, Content-Length");
    next();
  });

  // Completely disable Helmet to avoid any CORS/header conflicts
  // Helmet can interfere with CORS by setting restrictive headers
  // We'll handle security headers manually if needed
  // app.use(helmet());

  // Middleware to remove any restrictive headers and ensure CORS is always set
  app.use((_req, res, next) => {
    // Remove Referrer-Policy header if it exists (Helmet or browser default)
    try {
      res.removeHeader("Referrer-Policy");
    } catch (e) {
      // Header might not exist, ignore
    }
    // Ensure CORS headers are always present
    const origin = _req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    } else {
      res.header("Access-Control-Allow-Origin", "*");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, Cache-Control, Pragma"
    );
    res.header("Access-Control-Expose-Headers", "Content-Range, X-Content-Range, Content-Length");
    next();
  });

  // Compression middleware
  app.use(compression());

  // Handle preflight requests explicitly for all routes (must be after CORS setup)
  app.options("*", (req, res) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    } else {
      res.header("Access-Control-Allow-Origin", "*");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, Cache-Control, Pragma"
    );
    res.header("Access-Control-Max-Age", "86400");
    res.sendStatus(204);
  });

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
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    })
  );

  // Override Cross-Origin headers for static files to allow cross-origin access
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token"
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, X-Content-Range, Content-Length");
    next();
  });

  // Serve static uploads (before API routes to avoid versioning)
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // API routes (versioned)
  app.use("/api/v1", routes);

  // Root endpoint
  app.get("/", (req, res) => {
    // Ensure CORS headers are set
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    } else {
      res.header("Access-Control-Allow-Origin", "*");
    }
    res.json({
      message: "NEWS NEXT Backend API",
      version: "1.0.0",
      status: "running",
    });
  });

  // 404 handler
  app.use((req, res) => {
    // Ensure CORS headers are set even for 404 responses
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    } else {
      res.header("Access-Control-Allow-Origin", "*");
    }
    res.status(404).json({
      success: false,
      message: "Route not found",
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
};
