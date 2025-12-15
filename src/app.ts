import express, { Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
// import helmet from "helmet"; // Disabled to avoid CORS conflicts
import compression from "compression";
import path from "path";
import fs from "fs";
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

  // Additional CORS middleware layer - ensures headers are set even if first layer misses
  app.use((req, res, next) => {
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
      "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, Cache-Control, Pragma"
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, X-Content-Range, Content-Length");
    next();
  });

  // Completely disable Helmet to avoid any CORS/header conflicts
  // Helmet can interfere with CORS by setting restrictive headers
  // We'll handle security headers manually if needed
  // app.use(helmet());

  // CRITICAL: Middleware to set permissive headers and ensure CORS on ALL responses
  // This MUST run on every request to override any restrictive headers
  app.use((req, res, next) => {
    // Set headers immediately (before compression or any other middleware)
    if (!res.headersSent) {
      // Set most permissive Referrer-Policy
      res.setHeader("Referrer-Policy", "unsafe-url");
      
      // Remove any restrictive CORS-related headers
      try {
        res.removeHeader("Cross-Origin-Embedder-Policy");
        res.removeHeader("Cross-Origin-Opener-Policy");
      } catch (e) {
        // Ignore if headers don't exist
      }
      
      // ALWAYS set CORS headers on every response
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
        "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, Cache-Control, Pragma"
      );
      res.setHeader("Access-Control-Expose-Headers", "Content-Range, X-Content-Range, Content-Length");
      res.setHeader("Access-Control-Max-Age", "86400");
      
      // Set Cross-Origin-Resource-Policy to permissive
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
    
    next();
  });

  // Compression middleware
  app.use(compression());

  // Handle preflight requests explicitly for all routes (must be after CORS setup)
  app.options("*", (req, res) => {
    // Set most permissive Referrer-Policy
    res.setHeader("Referrer-Policy", "unsafe-url");
    
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
      "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, Cache-Control, Pragma"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
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
  // Use absolute path and ensure proper configuration
  const uploadsPath = path.join(process.cwd(), "uploads");
  
  // Verify uploads directory exists
  if (!fs.existsSync(uploadsPath)) {
    logger.warn(`⚠️  Uploads directory not found at ${uploadsPath}, creating it...`);
    fs.mkdirSync(uploadsPath, { recursive: true });
    // Also create subdirectories
    fs.mkdirSync(path.join(uploadsPath, "videos"), { recursive: true });
    fs.mkdirSync(path.join(uploadsPath, "thumbnails"), { recursive: true });
    fs.mkdirSync(path.join(uploadsPath, "chunks"), { recursive: true });
  }
  
  app.use(
    "/uploads",
    express.static(uploadsPath, {
      dotfiles: "ignore",
      etag: true,
      extensions: ["jpg", "jpeg", "png", "gif", "webp", "mp4", "webm", "mov", "avi", "mkv"],
      index: false,
      maxAge: "1y",
      setHeaders: (res, filePath) => {
        // Set proper content type
        if (filePath.endsWith(".mp4") || filePath.endsWith(".webm")) {
          res.setHeader("Content-Type", "video/mp4");
        }
        // Ensure CORS headers are set
        const origin = (res.req as any).headers?.origin;
        if (origin) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
        } else {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Referrer-Policy", "unsafe-url");
      },
    })
  );
  
  // Log uploads directory path for debugging
  logger.info(`📁 Static uploads directory: ${uploadsPath}`);
  logger.info(`📁 Uploads directory exists: ${fs.existsSync(uploadsPath)}`);
  
  // Test route to verify static file serving (for debugging)
  app.get("/uploads/test", (_req, res) => {
    const testFiles = fs.existsSync(uploadsPath) 
      ? fs.readdirSync(uploadsPath).slice(0, 5)
      : [];
    res.json({
      uploadsPath,
      exists: fs.existsSync(uploadsPath),
      files: testFiles,
      message: "Static file serving is configured",
    });
  });

  // API routes (versioned)
  app.use("/api/v1", routes);

  // Root endpoint
  app.get("/", (req, res) => {
    // Set most permissive Referrer-Policy
    res.setHeader("Referrer-Policy", "unsafe-url");
    
    // Ensure CORS headers are set
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.json({
      message: "NEWS NEXT Backend API",
      version: "1.0.0",
      status: "running",
    });
  });

  // 404 handler (only for non-static file routes)
  app.use((req, res) => {
    // Skip 404 for static file requests (they should be handled by express.static)
    // If we reach here for /uploads, it means the file doesn't exist
    if (req.path.startsWith("/uploads")) {
      // File not found in uploads directory
      res.status(404).json({
        success: false,
        message: "File not found",
        path: req.path,
      });
      return;
    }
    
    // Set most permissive Referrer-Policy
    res.setHeader("Referrer-Policy", "unsafe-url");
    
    // Ensure CORS headers are set even for 404 responses
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
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
