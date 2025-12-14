import { JobDefinition, JobStatus, JobResult } from "./types";
import { logger } from "@/utils/logger";
import prisma from "@/config/prisma";
import { FacebookClient } from "@/lib/facebook-client";
import { InstagramClient } from "@/lib/instagram-client";

const facebookClient = new FacebookClient();
const instagramClient = new InstagramClient();

/**
 * Social Token Refresh Job
 * Refreshes tokens for social accounts that are expiring soon (within 7 days)
 * Runs daily at 2 AM
 */
export const socialTokenRefreshJob: JobDefinition = {
  name: "social-token-refresh",
  schedule: "0 2 * * *", // Daily at 2 AM
  enabled: true,
  execute: async (): Promise<JobResult> => {
    const startTime = Date.now();

    try {
      // Get all active social accounts
      const accounts = await prisma.socialAccount.findMany({
        where: { isActive: true },
      });

      if (accounts.length === 0) {
        return {
          status: JobStatus.SUCCESS,
          message: "No active social accounts to refresh",
          executionTime: Date.now() - startTime,
          data: { accountsRefreshed: 0 },
        };
      }

      logger.info(`Starting token refresh for ${accounts.length} social accounts`);

      let successCount = 0;
      let failureCount = 0;
      const errors: Array<{ account: string; platform: string; error: string }> = [];

      // Check tokens expiring within 7 days
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      for (const account of accounts) {
        try {
          // Skip if token is not expiring soon
          if (account.tokenExpiry && account.tokenExpiry > sevenDaysFromNow) {
            continue;
          }

          logger.info(
            `Refreshing token for ${account.platform} account: ${account.name || account.id}`
          );

          let refreshedToken: string;
          let expiresIn: number | undefined;

          if (account.platform === "FACEBOOK") {
            const tokenResponse = await facebookClient.refreshToken(account.accessToken);
            refreshedToken = tokenResponse.access_token;
            expiresIn = tokenResponse.expires_in;
          } else if (account.platform === "INSTAGRAM") {
            const tokenResponse = await instagramClient.refreshToken(account.accessToken);
            refreshedToken = tokenResponse.access_token;
            expiresIn = tokenResponse.expires_in;
          } else {
            throw new Error(`Unsupported platform: ${account.platform}`);
          }

          // Calculate new expiry (60 days from now, or use expires_in if provided)
          const newExpiry = new Date();
          if (expiresIn) {
            newExpiry.setSeconds(newExpiry.getSeconds() + expiresIn);
          } else {
            newExpiry.setDate(newExpiry.getDate() + 60); // Default to 60 days
          }

          // Update account
          await prisma.socialAccount.update({
            where: { id: account.id },
            data: {
              accessToken: refreshedToken,
              tokenExpiry: newExpiry,
            },
          });

          successCount++;
          logger.info(
            `Successfully refreshed token for ${account.platform} account: ${account.name || account.id}`
          );
        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          errors.push({
            account: account.name || account.id,
            platform: account.platform,
            error: errorMessage,
          });
          logger.error(
            `Failed to refresh token for ${account.platform} account ${account.id}:`,
            error
          );

          // Mark account as inactive if refresh fails
          try {
            await prisma.socialAccount.update({
              where: { id: account.id },
              data: { isActive: false },
            });
            logger.warn(
              `Marked ${account.platform} account ${account.id} as inactive due to refresh failure`
            );
          } catch (updateError) {
            logger.error(`Failed to mark account ${account.id} as inactive:`, updateError);
          }
        }

        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const executionTime = Date.now() - startTime;
      const message = `Refreshed ${successCount} token(s), ${failureCount} failed`;

      if (failureCount > 0) {
        logger.warn(`Token refresh completed with ${failureCount} failures: ${message}`);
      } else {
        logger.info(`Token refresh completed successfully: ${message}`);
      }

      return {
        status: failureCount === 0 ? JobStatus.SUCCESS : JobStatus.FAILED,
        message,
        executionTime,
        data: {
          accountsRefreshed: successCount,
          accountsFailed: failureCount,
          totalAccounts: accounts.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error("Social token refresh job failed:", error);
      return {
        status: JobStatus.FAILED,
        message: `Job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        error: error instanceof Error ? error : new Error(String(error)),
        executionTime,
      };
    }
  },
};
