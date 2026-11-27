import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    BACKEND_PORT: z.coerce.number().int().positive().default(5000),
    MONGO_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'INVALID_MONGO_URI'),
    FRONTEND_URL: z.url(),
    JWT_SECRET: z.string().min(32),
    // Relative to the working directory, which is /app in the container.
    UPLOADS_DIR: z.string().default('uploads'),
    /**
     * How many reverse proxies sit in front, for `X-Forwarded-For`.
     *
     * A count, never `true`: trusting every hop lets a client spoof its own
     * address and walk past the rate limiter. `0` - the default, and what
     * development uses - trusts nothing.
     */
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    /**
     * Mail, which is optional as a whole.
     *
     * Absent, the application sends nothing and says so once at startup. Present,
     * it notifies the owner that someone used the contact form. Nothing else in
     * the application depends on it: the site works without a transport, and that
     * is deliberate for something that goes down at a provider's convenience.
     */
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().max(65535).optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    /** The envelope sender. A relay will refuse a From it does not own. */
    SMTP_FROM: z.email().optional(),
    /** Where a notification goes - not necessarily the address that signs in. */
    CONTACT_NOTIFY_TO: z.email().optional(),
  })
  /**
   * All of it or none of it: a half-configured transport looks enabled and
   * fails on the one message that mattered, so it fails at boot instead.
   * `SMTP_USER` and `SMTP_PASSWORD` stay optional, but as a pair.
   */
  .superRefine((value, ctx) => {
    const required = [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_FROM',
      'CONTACT_NOTIFY_TO',
    ] as const;
    const set = required.filter((name) => value[name] !== undefined);

    if (set.length > 0 && set.length < required.length) {
      for (const name of required.filter((n) => value[n] === undefined)) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: 'required once any SMTP variable is set',
        });
      }
    }

    if (
      (value.SMTP_USER === undefined) !==
      (value.SMTP_PASSWORD === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: [value.SMTP_USER === undefined ? 'SMTP_USER' : 'SMTP_PASSWORD'],
        message: 'SMTP_USER and SMTP_PASSWORD go together',
      });
    }
  });

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Env files surface unset variables as empty strings; treat them as absent
  // so schema defaults still apply.
  const provided = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ''),
  );

  const result = envSchema.safeParse(provided);

  if (!result.success) {
    // Runs before the logger exists; only variable names are printed, never values.
    const invalid = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    process.stderr.write(`Invalid environment configuration:\n${invalid}\n`);
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
