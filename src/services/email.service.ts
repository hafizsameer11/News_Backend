import { Resend } from "resend";
import nodemailer from "nodemailer";
import env from "@/config/env";
import { logger } from "@/utils/logger";
import { renderEmailTemplate, EmailTemplate } from "@/lib/email-templates";

/**
 * Email Service
 * Handles email sending via Resend or Nodemailer
 */
export class EmailService {
  private resendClient: Resend | null = null;
  private nodemailerTransporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeProvider();
  }

  /**
   * Initialize email provider based on configuration
   */
  private initializeProvider() {
    if (env.EMAIL_PROVIDER === "resend") {
      if (env.RESEND_API_KEY && env.RESEND_API_KEY !== "") {
        this.resendClient = new Resend(env.RESEND_API_KEY);
        logger.info("Email service initialized with Resend");
      } else {
        logger.warn("Resend API key not configured, email service will not work");
      }
    } else if (env.EMAIL_PROVIDER === "nodemailer") {
      if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
        // Fix Gmail host if user provided just "gmail.com"
        let smtpHost = env.SMTP_HOST;
        if (
          smtpHost === "gmail.com" ||
          (smtpHost.includes("gmail.com") && !smtpHost.startsWith("smtp."))
        ) {
          smtpHost = "smtp.gmail.com";
          logger.info(`Fixed SMTP host: ${env.SMTP_HOST} -> ${smtpHost}`);
        }

        this.nodemailerTransporter = nodemailer.createTransport({
          host: smtpHost,
          port: env.SMTP_PORT || 587,
          secure: env.SMTP_PORT === 465,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
          // Add connection timeout and retry settings
          connectionTimeout: 10000, // 10 seconds
          greetingTimeout: 10000,
          socketTimeout: 10000,
        });
        logger.info(
          `Email service initialized with Nodemailer (${smtpHost}:${env.SMTP_PORT || 587})`
        );
      } else {
        logger.warn("SMTP configuration incomplete, email service will not work");
      }
    }
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return (
      (env.EMAIL_PROVIDER === "resend" && this.resendClient !== null) ||
      (env.EMAIL_PROVIDER === "nodemailer" && this.nodemailerTransporter !== null)
    );
  }

  /**
   * Send email using configured provider
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      const error = "Email service is not configured";
      logger.error(error);
      return { success: false, error };
    }

    try {
      if (env.EMAIL_PROVIDER === "resend" && this.resendClient) {
        // Resend requires verified domain - Gmail addresses won't work
        // For testing, use onboarding@resend.dev (Resend's default test domain)
        // For production, verify your domain in Resend dashboard
        let fromAddress = env.EMAIL_FROM_ADDRESS;

        // Check if using Gmail or unverified domain - use Resend test domain for development
        if (
          fromAddress.includes("@gmail.com") ||
          fromAddress.includes("@yahoo.com") ||
          fromAddress.includes("@hotmail.com") ||
          fromAddress.includes("@outlook.com")
        ) {
          logger.warn(
            `Gmail/Yahoo addresses cannot be used with Resend. Using Resend test domain instead. Please verify your domain in Resend dashboard for production.`
          );
          fromAddress = "onboarding@resend.dev";
        }

        const result = await this.resendClient.emails.send({
          from: `${env.EMAIL_FROM_NAME} <${fromAddress}>`,
          to,
          subject,
          html,
          text,
        });

        if (result.error) {
          logger.error("Resend email error:", {
            error: result.error,
            message: result.error.message,
            name: result.error.name,
            to,
            from: env.EMAIL_FROM_ADDRESS,
          });
          return { success: false, error: result.error.message || "Unknown Resend error" };
        }

        logger.info(`Email sent successfully to ${to} via Resend`, {
          messageId: result.data?.id,
          from: env.EMAIL_FROM_ADDRESS,
        });
        return { success: true, messageId: result.data?.id };
      } else if (env.EMAIL_PROVIDER === "nodemailer" && this.nodemailerTransporter) {
        try {
          const info = await this.nodemailerTransporter.sendMail({
            from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]+>/g, ""),
          });

          logger.info(`Email sent successfully to ${to} via Nodemailer`, {
            messageId: info.messageId,
            from: env.EMAIL_FROM_ADDRESS,
          });
          return { success: true, messageId: info.messageId };
        } catch (nodemailerError: any) {
          // Provide helpful error messages for common Gmail issues
          let errorMessage = nodemailerError.message || "Unknown error";
          if (nodemailerError.code === "EAUTH" || nodemailerError.responseCode === 535) {
            errorMessage =
              "Authentication failed. For Gmail, you must use an App Password, not your regular password. See: https://support.google.com/accounts/answer/185833";
          } else if (nodemailerError.code === "ETIMEDOUT" || nodemailerError.code === "ESOCKET") {
            errorMessage = `Connection timeout. Check your SMTP settings. For Gmail, ensure you're using smtp.gmail.com and port 587. Also check firewall/network settings.`;
          } else if (nodemailerError.code === "ECONNREFUSED") {
            errorMessage = `Connection refused. Check SMTP_HOST (should be smtp.gmail.com for Gmail) and SMTP_PORT (587 for Gmail).`;
          }

          logger.error(`Nodemailer email error:`, {
            error: errorMessage,
            code: nodemailerError.code,
            responseCode: nodemailerError.responseCode,
            to,
            from: env.EMAIL_FROM_ADDRESS,
            smtpHost: env.SMTP_HOST,
          });

          return { success: false, error: errorMessage };
        }
      }

      return { success: false, error: "No email provider configured" };
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      logger.error(`Failed to send email to ${to}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    try {
      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      const { html, text } = renderEmailTemplate(EmailTemplate.PASSWORD_RESET, {
        resetUrl,
      });

      const result = await this.sendEmail(
        email,
        `Reset Your Password - ${env.SITE_NAME}`,
        html,
        text
      );

      return result.success;
    } catch (error) {
      logger.error("Failed to send password reset email:", error);
      return false;
    }
  }

  /**
   * Send newsletter welcome email
   */
  async sendNewsletterWelcomeEmail(email: string): Promise<boolean> {
    try {
      const { html, text } = renderEmailTemplate(EmailTemplate.NEWSLETTER_WELCOME);

      const result = await this.sendEmail(
        email,
        `Welcome to ${env.SITE_NAME} Newsletter!`,
        html,
        text
      );

      return result.success;
    } catch (error) {
      logger.error("Failed to send newsletter welcome email:", error);
      return false;
    }
  }

  /**
   * Send breaking news alert
   */
  async sendBreakingNewsAlert(
    email: string,
    news: {
      id: string;
      title: string;
      summary?: string;
      mainImage?: string;
      slug: string;
    }
  ): Promise<boolean> {
    try {
      const newsUrl = `${env.FRONTEND_URL}/news/${news.slug}`;
      const unsubscribeUrl = `${env.FRONTEND_URL}/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;

      const { html, text } = renderEmailTemplate(EmailTemplate.BREAKING_NEWS, {
        newsTitle: news.title,
        newsSummary: news.summary,
        newsImage: news.mainImage,
        newsUrl,
        unsubscribeUrl,
      });

      const result = await this.sendEmail(email, `🚨 Breaking News: ${news.title}`, html, text);

      return result.success;
    } catch (error) {
      logger.error("Failed to send breaking news alert:", error);
      return false;
    }
  }

  /**
   * Send ad approval notification
   */
  async sendAdApprovalEmail(
    email: string,
    ad: {
      id: string;
      title: string;
      type: string;
      startDate: Date;
      endDate: Date;
    }
  ): Promise<boolean> {
    try {
      const adDashboardUrl = `${env.FRONTEND_URL}/advertiser/ads/${ad.id}`;

      const { html, text } = renderEmailTemplate(EmailTemplate.AD_APPROVED, {
        adTitle: ad.title,
        adType: ad.type,
        adStartDate: new Date(ad.startDate).toLocaleDateString(),
        adEndDate: new Date(ad.endDate).toLocaleDateString(),
        adDashboardUrl,
      });

      const result = await this.sendEmail(
        email,
        `Your Ad Has Been Approved - ${env.SITE_NAME}`,
        html,
        text
      );

      return result.success;
    } catch (error) {
      logger.error("Failed to send ad approval email:", error);
      return false;
    }
  }

  /**
   * Send ad rejection notification
   */
  async sendAdRejectionEmail(
    email: string,
    ad: {
      id: string;
      title: string;
    },
    reason: string
  ): Promise<boolean> {
    try {
      const adDashboardUrl = `${env.FRONTEND_URL}/advertiser/ads/${ad.id}`;

      const { html, text } = renderEmailTemplate(EmailTemplate.AD_REJECTED, {
        adTitle: ad.title,
        rejectionReason: reason,
        adDashboardUrl,
      });

      const result = await this.sendEmail(email, `Ad Review Update - ${env.SITE_NAME}`, html, text);

      return result.success;
    } catch (error) {
      logger.error("Failed to send ad rejection email:", error);
      return false;
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
    try {
      const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      const { html, text } = renderEmailTemplate(EmailTemplate.EMAIL_VERIFICATION, {
        verificationUrl,
      });

      const result = await this.sendEmail(
        email,
        `Verify Your Email - ${env.SITE_NAME}`,
        html,
        text
      );

      return result.success;
    } catch (error) {
      logger.error("Failed to send verification email:", error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
