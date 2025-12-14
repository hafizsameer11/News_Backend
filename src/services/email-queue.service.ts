import prisma from "@/config/prisma";
import { emailService } from "./email.service";
import { logger } from "@/utils/logger";
import { EmailQueueStatus } from "@prisma/client";

type RetryFailedEmailsResult = {
  retried: number;
  succeeded: number;
  failed: number;
};

/**
 * Email Queue Service
 * Manages email queue for async email sending
 */
export class EmailQueueService {
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 50;

  /**
   * Enqueue email for sending
   */
  async enqueueEmail(to: string, subject: string, html: string, text?: string): Promise<string> {
    const emailQueue = await prisma.emailQueue.create({
      data: {
        to,
        subject,
        html,
        text,
        status: EmailQueueStatus.PENDING,
        retryCount: 0,
      },
    });

    logger.debug(`Email queued: ${emailQueue.id} to ${to}`);
    return emailQueue.id;
  }

  /**
   * Process pending emails from queue
   */
  async processQueue(limit: number = this.BATCH_SIZE): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const pendingEmails = await prisma.emailQueue.findMany({
      where: {
        status: EmailQueueStatus.PENDING,
        retryCount: { lt: this.MAX_RETRIES },
      },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    if (pendingEmails.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    logger.info(`Processing ${pendingEmails.length} queued email(s)`);

    let succeeded = 0;
    let failed = 0;

    for (const email of pendingEmails) {
      try {
        const result = await emailService.sendEmail(
          email.to,
          email.subject,
          email.html,
          email.text || undefined
        );

        if (result.success) {
          await prisma.emailQueue.update({
            where: { id: email.id },
            data: {
              status: EmailQueueStatus.SENT,
              sentAt: new Date(),
              errorMessage: null,
            },
          });
          succeeded++;
        } else {
          await this.handleFailedEmail(email.id, result.error || "Unknown error");
          failed++;
        }
      } catch (error: any) {
        logger.error(`Error processing email ${email.id}:`, error);
        await this.handleFailedEmail(email.id, error.message || "Unknown error");
        failed++;
      }
    }

    logger.info(`Email queue processed: ${succeeded} succeeded, ${failed} failed`);

    return {
      processed: pendingEmails.length,
      succeeded,
      failed,
    };
  }

  /**
   * Handle failed email (increment retry count or mark as failed)
   */
  private async handleFailedEmail(emailId: string, errorMessage: string) {
    const email = await prisma.emailQueue.findUnique({
      where: { id: emailId },
    });

    if (!email) return;

    const newRetryCount = email.retryCount + 1;

    if (newRetryCount >= this.MAX_RETRIES) {
      // Max retries reached, mark as failed
      await prisma.emailQueue.update({
        where: { id: emailId },
        data: {
          status: EmailQueueStatus.FAILED,
          errorMessage,
          retryCount: newRetryCount,
        },
      });
      logger.warn(`Email ${emailId} marked as failed after ${this.MAX_RETRIES} retries`);
    } else {
      // Increment retry count, keep as PENDING for next retry
      await prisma.emailQueue.update({
        where: { id: emailId },
        data: {
          retryCount: newRetryCount,
          errorMessage,
        },
      });
      logger.debug(`Email ${emailId} retry count increased to ${newRetryCount}`);
    }
  }

  /**
   * Retry failed emails (with exponential backoff)
   */
  async retryFailedEmails(): Promise<RetryFailedEmailsResult> {
    const failedEmails = await prisma.emailQueue.findMany({
      where: {
        status: EmailQueueStatus.FAILED,
        retryCount: { lt: this.MAX_RETRIES },
        // Only retry emails that failed more than 1 hour ago (exponential backoff)
        updatedAt: {
          lte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
      take: this.BATCH_SIZE,
      orderBy: { updatedAt: "asc" },
    });

    if (failedEmails.length === 0) {
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    logger.info(`Retrying ${failedEmails.length} failed email(s)`);

    // Reset status to PENDING for retry
    await prisma.emailQueue.updateMany({
      where: {
        id: { in: failedEmails.map((e: { id: string }) => e.id) },
      },
      data: {
        status: EmailQueueStatus.PENDING,
        errorMessage: null,
      },
    });

    // Process the retried emails
    const result = await this.processQueue(failedEmails.length);

    return {
      retried: failedEmails.length,
      succeeded: result.succeeded,
      failed: result.failed,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    sent: number;
    failed: number;
    total: number;
  }> {
    const [pending, sent, failed, total] = await Promise.all([
      prisma.emailQueue.count({
        where: { status: EmailQueueStatus.PENDING },
      }),
      prisma.emailQueue.count({
        where: { status: EmailQueueStatus.SENT },
      }),
      prisma.emailQueue.count({
        where: { status: EmailQueueStatus.FAILED },
      }),
      prisma.emailQueue.count(),
    ]);

    return { pending, sent, failed, total };
  }

  /**
   * Clean up old sent emails (older than 30 days)
   */
  async cleanupOldEmails(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.emailQueue.deleteMany({
      where: {
        status: EmailQueueStatus.SENT,
        sentAt: {
          lte: cutoffDate,
        },
      },
    });

    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} old sent email(s)`);
    }

    return result.count;
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService();
