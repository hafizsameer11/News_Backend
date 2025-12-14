/**
 * Custom error types for social media integration
 */

export class SocialAPIError extends Error {
  constructor(
    message: string,
    public platform: "FACEBOOK" | "INSTAGRAM",
    public statusCode?: number,
    public apiError?: any
  ) {
    super(message);
    this.name = "SocialAPIError";
    Object.setPrototypeOf(this, SocialAPIError.prototype);
  }
}

export class TokenExpiredError extends Error {
  constructor(
    message: string = "Access token has expired",
    public platform?: "FACEBOOK" | "INSTAGRAM"
  ) {
    super(message);
    this.name = "TokenExpiredError";
    Object.setPrototypeOf(this, TokenExpiredError.prototype);
  }
}

export class OAuthError extends Error {
  constructor(
    message: string,
    public errorCode?: string,
    public errorReason?: string
  ) {
    super(message);
    this.name = "OAuthError";
    Object.setPrototypeOf(this, OAuthError.prototype);
  }
}

export class WebhookVerificationError extends Error {
  constructor(message: string = "Webhook verification failed") {
    super(message);
    this.name = "WebhookVerificationError";
    Object.setPrototypeOf(this, WebhookVerificationError.prototype);
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string = "Rate limit exceeded. Please try again later.",
    public retryAfter?: number
  ) {
    super(message);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}
