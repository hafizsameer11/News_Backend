import express, { Express } from "express";
import cors from "cors";
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

  // Webhook routes must be before JSON parser (handles raw body)
  // Increase limit for webhooks as well (Stripe webhooks can be large)
  app.use("/api/v1/payment/webhook", express.raw({ type: "application/json", limit: "10mb" }));
  app.use("/api/v1/social/webhook", express.raw({ type: "application/json", limit: "10mb" }));

  // Body parsing middleware with increased size limits for large content
  // Default is 100kb, increasing to 50MB to handle large news articles with rich content
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
  
  // Direct route handler for uploads (more reliable than express.static in some cases)
  // This handles file serving with better error handling and logging
  // Must be defined BEFORE express.static to take precedence
  // Use wildcard to match any filename (including those with extensions)
  app.get("/uploads/:filename", (req, res) => {
    const filename = req.params.filename;
    // Handle subdirectories (e.g., videos/file.mp4)
    const filePath = path.join(uploadsPath, filename);
    
    // Security: prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsPath = path.resolve(uploadsPath);
    if (!resolvedPath.startsWith(resolvedUploadsPath)) {
      logger.warn(`Directory traversal attempt: ${req.path}`);
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.warn(`File not found: ${filePath} (requested: ${req.path}, cwd: ${process.cwd()})`);
      return res.status(404).json({ 
        success: false, 
        message: "File not found",
        path: filePath,
        uploadsPath,
        cwd: process.cwd(),
        requestedPath: req.path,
      });
    }

    // Check if it's a file (not a directory)
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return res.status(404).json({ success: false, message: "Not a file" });
    }

    // Set proper content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".mkv": "video/x-matroska",
    };
    if (contentTypes[ext]) {
      res.setHeader("Content-Type", contentTypes[ext]);
    }

    // Set CORS headers
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Referrer-Policy", "unsafe-url");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // Send file
    return res.sendFile(filePath);
  });

  // Static file serving for uploads (fallback for subdirectories)
  // This must be before the 404 handler
  app.use(
    "/uploads",
    (req, _res, next) => {
      // Log static file requests for debugging
      if (process.env.NODE_ENV === "development" || process.env.DEBUG_STATIC === "true") {
        const requestedFile = path.join(uploadsPath, req.path.replace(/^\/uploads\//, ""));
        logger.debug(`Static file request: ${req.path} -> ${requestedFile} (exists: ${fs.existsSync(requestedFile)})`);
      }
      next();
    },
    express.static(uploadsPath, {
      dotfiles: "ignore",
      etag: true,
      index: false,
      maxAge: "1y",
      setHeaders: (res, filePath) => {
        // Set proper content type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".mp4": "video/mp4",
          ".webm": "video/webm",
          ".mov": "video/quicktime",
          ".avi": "video/x-msvideo",
          ".mkv": "video/x-matroska",
        };
        if (contentTypes[ext]) {
          res.setHeader("Content-Type", contentTypes[ext]);
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
      cwd: process.cwd(),
    });
  });

  // Diagnostic route to check if a specific file exists
  app.get("/uploads/check/:filename", (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(uploadsPath, filename);
    const exists = fs.existsSync(filePath);
    
    res.json({
      filename,
      filePath,
      exists,
      uploadsPath,
      cwd: process.cwd(),
      stats: exists ? {
        size: fs.statSync(filePath).size,
        modified: fs.statSync(filePath).mtime,
      } : null,
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
