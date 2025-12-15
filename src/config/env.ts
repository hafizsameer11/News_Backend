import dotenv from "dotenv";
import { z } from "zod";
import path from "path";

// Load environment variables from backend/.env
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

// Log if .env file exists
if (process.env.STRIPE_SECRET_KEY) {
  console.log(
    `✅ Loaded STRIPE_SECRET_KEY from .env (${process.env.STRIPE_SECRET_KEY.substring(0, 12)}...)`
  );
} else {
  console.warn("⚠️  STRIPE_SECRET_KEY not found in process.env");
}

if (process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY !== "") {
  console.log(`✅ Loaded OPENWEATHER_API_KEY from .env`);
} else {
  console.warn("⚠️  OPENWEATHER_API_KEY not found in process.env - Weather API will not work");
}

if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "") {
  console.log(`✅ Loaded RESEND_API_KEY from .env`);
} else {
  console.warn("⚠️  RESEND_API_KEY not found in process.env - Email service will not work");
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number).default("3001"),
  DATABASE_URL: z.string().default("mysql://root@localhost:3306/news_db"),
  JWT_SECRET: z
    .string()
    .min(32)
    .default("your-super-secret-jwt-key-change-this-in-production-min-32-chars-please"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
  STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
  OPENWEATHER_API_KEY: z.string().default(""),
  HOROSCOPE_API_KEY: z.string().optional(),
  // Video upload configuration
  MAX_VIDEO_SIZE: z.string().transform(Number).default("1073741824"), // 1GB in bytes
  VIDEO_CHUNK_SIZE: z.string().transform(Number).default("5242880"), // 5MB in bytes
  VIDEO_UPLOAD_DIR: z.string().default("uploads/videos"),
  THUMBNAIL_DIR: z.string().default("uploads/thumbnails"),
  FFMPEG_PATH: z.string().optional(),
  ENABLE_VIDEO_TRANSCODING: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  // Social Media Integration (Facebook/Instagram)
  FACEBOOK_APP_ID: z.string().default(""),
  FACEBOOK_APP_SECRET: z.string().default(""),
  INSTAGRAM_APP_ID: z.string().default(""),
  INSTAGRAM_APP_SECRET: z.string().default(""),
  FACEBOOK_REDIRECT_URI: z
    .string()
    .default("http://localhost:3001/api/social/oauth/facebook/callback"),
  INSTAGRAM_REDIRECT_URI: z
    .string()
    .default("http://localhost:3001/api/social/oauth/instagram/callback"),
  FACEBOOK_WEBHOOK_VERIFY_TOKEN: z.string().default(""),
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().default(""),
  // Redis/Caching Configuration (Optional)
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  CACHE_TTL_SECONDS: z.string().transform(Number).default("3600"), // 1 hour default
  // SEO Configuration
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  BACKEND_URL: z.string().default("http://localhost:3001"),
  SITE_NAME: z.string().default("NEWS NEXT"),
  SITE_DESCRIPTION: z.string().default("Calabria's premier news portal"),
  SITE_IMAGE: z.string().default(""),
  // Email Configuration
  EMAIL_PROVIDER: z.enum(["resend", "nodemailer"]).default("resend"),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM_ADDRESS: z.string().default("noreply@newsnext.it"),
  EMAIL_FROM_NAME: z.string().default("NEWS NEXT"),
  ENABLE_EMAIL_VERIFICATION: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  // SMTP Configuration (for Nodemailer fallback)
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.string().transform(Number).optional().default("587"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  // Google Analytics 4 Configuration
  GA4_MEASUREMENT_ID: z.string().optional().default(""),
  GA4_API_SECRET: z.string().optional().default(""),
  GA4_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  // Analytics Configuration
  ANALYTICS_RETENTION_DAYS: z.string().transform(Number).default("365"),
});

type EnvConfig = z.infer<typeof envSchema>;

let env: EnvConfig;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:");
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join(".")}: ${err.message}`);
    });
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
  throw error;
}

export default env;
