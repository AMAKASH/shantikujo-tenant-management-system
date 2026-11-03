import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
  APP_URL: z.string().default("http://localhost:3000"),
  SESSION_DAYS: z.coerce.number().default(30),
  UPLOAD_DIR: z.string().default("./uploads"),
  S3_BUCKET: z.string().optional().default(""),
  S3_REGION: z.string().optional().default("ap-southeast-1"),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  ENABLE_CRON: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === "production";
