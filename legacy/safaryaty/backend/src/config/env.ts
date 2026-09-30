import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_PROVIDER: z.enum(["sqlite", "postgresql"]).default("sqlite"),
  POSTGRES_DATABASE_URL: z.string().optional(),
  POSTGRES_TARGET_KIND: z.enum(["staging"]).optional(),
  POSTGRES_STAGING_ACK: z.string().optional(),
  POSTGRES_VERIFICATION_RECEIPT: z.string().optional(),
  APP_ORIGIN: z.string().default("http://127.0.0.1:5173"),
  SESSION_COOKIE_NAME: z.string().default("safaryaty_session"),
  SESSION_DAYS: z.coerce.number().default(30),
  UPLOAD_DIR: z.string().default("uploads"),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  OAUTH_SUCCESS_REDIRECT: z.string().optional(),
  OAUTH_FAILURE_REDIRECT: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  REST_COUNTRIES_BASE_URL: z.string().url().default("https://restcountries.com/v3.1"),
  REST_COUNTRIES_API_KEY: z.string().optional(),
  COUNTRY_METADATA_TTL_HOURS: z.coerce.number().int().positive().default(168),
  FRANKFURTER_BASE_URL: z.string().url().default("https://api.frankfurter.dev"),
  FX_RATE_TTL_HOURS: z.coerce.number().int().positive().default(24)
});

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
