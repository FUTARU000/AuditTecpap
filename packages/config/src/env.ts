import { z } from 'zod';

/**
 * Shared environment schema. Individual apps may extend or subset it.
 * Validates at boot so misconfiguration fails fast.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // HTTP
  WEB_PORT: z.coerce.number().default(3000),
  API_PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().optional(),
  API_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),

  // JWT / Auth
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(604800),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // MinIO
  MINIO_ENDPOINT: z.string().url(),
  MINIO_PUBLIC_ENDPOINT: z.string().url().optional(),
  MINIO_REGION: z.string().default('us-east-1'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_USE_SSL: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(false),
  MINIO_BUCKET_EVIDENCE: z.string().default('tecpap-evidence'),
  MINIO_BUCKET_DOCUMENTS: z.string().default('tecpap-documents'),
  MINIO_BUCKET_CERTIFICATES: z.string().default('tecpap-certificates'),
  MINIO_BUCKET_REPORTS: z.string().default('tecpap-reports'),

  // Google Drive (manual import source only — optional; the feature is
  // disabled with a clear error until both are configured).
  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Parse and validate the environment. Throws a descriptive error on failure.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
