import prisma from "@/config/prisma";
import { logger } from "@/utils/logger";

export interface WebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging?: Array<any>;
    changes?: Array<{
      value: any;
      field: string;
    }>;
  }>;
}

export class SocialWebhookService {
  /**
   * Verify Facebook webhook (GET request)
   */
  verifyFacebookWebhook(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string
  ): string | null {
    if (mode === "subscribe" && token === verifyToken) {
      logger.info("Facebook webhook verified successfully");
      return challenge;
    }
    logger.warn("Facebook webhook verification failed");
    return null;
  }

  /**
   * Verify Instagram webhook (GET request)
   */
  verifyInstagramWebhook(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string
  ): string | null {
    if (mode === "subscribe" && token === verifyToken) {
      logger.info("Instagram webhook verified successfully");
      return challenge;
    }
    logger.warn("Instagram webhook verification failed");
    return null;
  }

  /**
   * Process Facebook webhook events
   */
  async processFacebookWebhook(event: WebhookEvent): Promise<void> {
    try {
      for (const entry of event.entry) {
        // Handle feed events (post created, updated, deleted)
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "feed") {
              await this.handleFeedEvent(change.value, "FACEBOOK");
            }
          }
        }

        // Handle comments events
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "comments") {
              await this.handleCommentEvent(change.value, "FACEBOOK");
            }
          }
        }

        // Handle reactions events
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "reactions") {
              await this.handleReactionEvent(change.value, "FACEBOOK");
            }
          }
        }
      }
    } catch (error) {
      logger.error("Error processing Facebook webhook:", error);
      throw error;
    }
  }

  /**
   * Process Instagram webhook events
   */
  async processInstagramWebhook(event: WebhookEvent): Promise<void> {
    try {
      for (const entry of event.entry) {
        // Handle feed events
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "feed") {
              await this.handleFeedEvent(change.value, "INSTAGRAM");
            }
          }
        }

        // Handle comments events
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "comments") {
              await this.handleCommentEvent(change.value, "INSTAGRAM");
            }
          }
        }
      }
    } catch (error) {
      logger.error("Error processing Instagram webhook:", error);
      throw error;
    }
  }

  /**
   * Handle feed events (post created, updated, deleted)
   */
  private async handleFeedEvent(value: any, platform: "FACEBOOK" | "INSTAGRAM"): Promise<void> {
    try {
      const postId = value.post_id || value.id;
      if (!postId) return;

      // Find the post log by matching post ID in message field
      const postLog = await prisma.socialPostLog.findFirst({
        where: {
          platform,
          message: {
            contains: postId,
          },
        },
        orderBy: {
          postedAt: "desc",
        },
      });

      if (postLog) {
        // Update engagement metrics if available
        // Note: We would need to fetch current metrics from Graph API
        logger.info(`Feed event for ${platform} post: ${postId}`);
      }
    } catch (error) {
      logger.error(`Error handling feed event for ${platform}:`, error);
    }
  }

  /**
   * Handle comment events
   */
  private async handleCommentEvent(value: any, platform: "FACEBOOK" | "INSTAGRAM"): Promise<void> {
    try {
      const postId = value.post_id || value.parent_id;
      if (!postId) return;

      logger.info(`Comment event for ${platform} post: ${postId}`);
      // Could update comment count in SocialPostLog or create separate engagement tracking
    } catch (error) {
      logger.error(`Error handling comment event for ${platform}:`, error);
    }
  }

  /**
   * Handle reaction events (likes, reactions)
   */
  private async handleReactionEvent(value: any, platform: "FACEBOOK" | "INSTAGRAM"): Promise<void> {
    try {
      const postId = value.post_id || value.parent_id;
      if (!postId) return;

      logger.info(`Reaction event for ${platform} post: ${postId}`);
      // Could update like/reaction count in SocialPostLog or create separate engagement tracking
    } catch (error) {
      logger.error(`Error handling reaction event for ${platform}:`, error);
    }
  }

  /**
   * Fetch and update engagement metrics for a post
   */
  async updatePostEngagement(postLogId: string, platform: "FACEBOOK" | "INSTAGRAM"): Promise<void> {
    try {
      const postLog = await prisma.socialPostLog.findUnique({
        where: { id: postLogId },
      });

      if (!postLog) {
        throw new Error("Post log not found");
      }

      // Extract post ID from message
      const postIdMatch = postLog.message?.match(/Post ID: (.+)/);
      if (!postIdMatch) {
        logger.warn(`Could not extract post ID from log message: ${postLog.message}`);
        return;
      }

      const postId = postIdMatch[1];
      const account = await prisma.socialAccount.findFirst({
        where: {
          platform,
          isActive: true,
        },
      });

      if (!account) {
        throw new Error(`No active ${platform} account found`);
      }

      // Fetch engagement metrics from Graph API
      // This would require additional API calls to get likes, comments, shares
      // For now, we'll just log that we would update this
      logger.info(`Would update engagement metrics for ${platform} post: ${postId}`);
    } catch (error) {
      logger.error(`Error updating post engagement for ${postLogId}:`, error);
    }
  }
}
