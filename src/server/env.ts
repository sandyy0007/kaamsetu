import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32).optional(),
  DEMO_MODE: bool,
  DATABASE_URL: z.string().optional(),
  OTP_DEV_MODE: bool,
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  AUTH_TESTING_MODE: bool,
  TEST_ACCOUNT_PHONES: z.string().optional(),
  SMS_PROVIDER: z.enum(["console", "fast2sms", "msg91", "twilio"]).default("console"),
  FAST2SMS_API_KEY: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  MSG91_SENDER_ID: z.string().default("KMSETU"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  DEMO_STORE_FILE: z.string().optional(),
  AI_PROVIDER: z.enum(["rules", "openai-compatible"]).default("rules"),
  AI_BASE_URL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".data/uploads"),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  MAPS_PROVIDER: z.enum(["static", "google", "mapbox"]).default("static"),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  PUSH_PROVIDER: z.enum(["none", "webpush", "fcm"]).default("none"),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:admin@kaamsetu.org"),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  LIVE_PROVIDER: z.enum(["none", "livekit", "mux"]).default("none"),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_WS_URL: z.string().optional(),
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function resetEnvCache() {
  cached = null;
}

/** Validated server environment. Secrets are read here only — never from client code. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  const isProd = parsed.NODE_ENV === "production";
  if (isProd && !parsed.SESSION_SECRET) {
    throw new Error("SESSION_SECRET (min 32 chars) must be set in production");
  }
  if (isProd && parsed.DEMO_MODE) {
    throw new Error("DEMO_MODE must be false in production. Real PostgreSQL persistence is strictly required.");
  }
  if (isProd && !parsed.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured in production.");
  }
  if (isProd && parsed.OTP_DEV_MODE) {
    throw new Error("OTP_DEV_MODE must be false in production. Real SMS delivery gateway is strictly required.");
  }
  if (isProd && parsed.AUTH_TESTING_MODE) {
    console.warn(
      "[SECURITY WARNING] AUTH_TESTING_MODE is active in production. Unverified testing account registration is permitted without SMS. Sensitive features remain restricted. Set AUTH_TESTING_MODE=false once SMS provider is configured."
    );
  }
  cached = parsed;
  return cached;
}

/** Dev-only fallback secret so `npm run dev` works without configuration. */
export function sessionSecret(): string {
  const e = env();
  return e.SESSION_SECRET ?? "dev-only-insecure-session-secret-change-me-0123456789";
}
