import env from "@/config/env";
import { createApp } from "./app";
import { logger } from "@/utils/logger";
import prisma from "@/config/prisma";
import { jobScheduler } from "@/jobs";
import { weatherUpdateJob } from "@/jobs/weather.job";
import { horoscopeDailyJob, horoscopeWeeklyJob } from "@/jobs/horoscope.job";
import { adExpirationJob } from "@/jobs/ad-expiration.job";
import { videoProcessingJob } from "@/jobs/video-processing.job";
import { socialTokenRefreshJob } from "@/jobs/social-token-refresh.job";
import { emailQueueJob } from "@/jobs/email-queue.job";

/**
 * Start the server
 */
const startServer = async () => {
  try {
    // Test database connection with retries
    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await prisma.$connect();
        logger.info("✅ Database connected successfully");
        break;
      } catch (error: any) {
        logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        if (attempt < maxRetries) {
          logger.info(`Retrying in ${retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          logger.error("❌ Failed to connect to database after all retries. Server will start but database operations may fail.");
          // Continue anyway - let health check endpoint handle it
        }
      }
    }

    // Register and start scheduled jobs (non-blocking - don't fail if jobs fail)
    try {
      jobScheduler.registerJob(weatherUpdateJob);
      jobScheduler.registerJob(horoscopeDailyJob);
      jobScheduler.registerJob(horoscopeWeeklyJob);
      jobScheduler.registerJob(adExpirationJob);
      jobScheduler.registerJob(videoProcessingJob);
      jobScheduler.registerJob(socialTokenRefreshJob);
      jobScheduler.registerJob(emailQueueJob);
      jobScheduler.start();
      logger.info("✅ Scheduled jobs registered and started");
    } catch (error: any) {
      logger.warn(`⚠️  Failed to register some scheduled jobs: ${error.message}. Server will continue.`);
    }

    // Create Express app
    const app = createApp();

    // Start server - bind to 0.0.0.0 to accept connections from outside container
    const server = app.listen(env.PORT, "0.0.0.0", () => {
      logger.info(`🚀 Server running on port ${env.PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
      logger.info(`🌐 API: http://0.0.0.0:${env.PORT}/api`);

      // Log Stripe configuration status
      if (env.STRIPE_SECRET_KEY && env.STRIPE_SECRET_KEY !== "sk_test_placeholder") {
        logger.info(`✅ Stripe configured: ${env.STRIPE_SECRET_KEY.substring(0, 12)}...`);
      } else {
        logger.warn("⚠️  Stripe secret key not configured. Set STRIPE_SECRET_KEY in .env file");
      }
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Stop all scheduled jobs
      jobScheduler.stop();

      server.close(async () => {
        logger.info("HTTP server closed");

        await prisma.$disconnect();
        logger.info("Database disconnected");

        // eslint-disable-next-line no-process-exit
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
};

// Start the server
startServer();
