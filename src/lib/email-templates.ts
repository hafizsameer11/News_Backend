import Handlebars from "handlebars";
import fs from "fs";
import path from "path";
import env from "@/config/env";

/**
 * Email Template Renderer
 * Loads and compiles Handlebars templates with variable injection
 */

const templatesDir = path.join(process.cwd(), "src", "templates", "emails");
const templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

/**
 * Get template from cache or load and compile it
 */
function getTemplate(templateName: string): HandlebarsTemplateDelegate {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  const templatePath = path.join(templatesDir, `${templateName}.hbs`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templateName}`);
  }

  const templateContent = fs.readFileSync(templatePath, "utf-8");
  const compiled = Handlebars.compile(templateContent);
  templateCache.set(templateName, compiled);

  return compiled;
}

/**
 * Get common template variables
 */
function getCommonVariables() {
  return {
    siteName: env.SITE_NAME,
    frontendUrl: env.FRONTEND_URL,
    currentYear: new Date().getFullYear(),
  };
}

/**
 * Render email template
 */
export function renderEmailTemplate(
  templateName: string,
  variables: Record<string, any> = {}
): { html: string; text?: string } {
  const template = getTemplate(templateName);
  const allVariables = {
    ...getCommonVariables(),
    ...variables,
  };

  const html = template(allVariables);

  // Generate plain text version (simple strip of HTML tags)
  // For production, consider using a proper HTML-to-text converter
  const text = html
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return { html, text };
}

/**
 * Available email templates
 */
export enum EmailTemplate {
  PASSWORD_RESET = "password-reset",
  NEWSLETTER_WELCOME = "newsletter-welcome",
  BREAKING_NEWS = "breaking-news",
  AD_APPROVED = "ad-approved",
  AD_REJECTED = "ad-rejected",
  EMAIL_VERIFICATION = "email-verification",
}
