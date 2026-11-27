import { createRequire } from 'node:module';

import { pino } from 'pino';

import { env } from '../../config/env.js';

/**
 * Pretty logs are a development convenience, and `pino-pretty` is a dev
 * dependency. Asking for it by name is enough to crash a production image
 * installed with `--omit=dev` before a single handler runs, so it is used only
 * when it is actually there.
 */
function prettyTransport() {
  if (env.NODE_ENV !== 'development') {
    return undefined;
  }

  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return { target: 'pino-pretty' };
  } catch {
    return undefined;
  }
}

export const logger = pino({
  level: env.LOG_LEVEL,
  // Never let credentials or tokens reach the logs.
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'password',
    'token',
    '*.password',
    '*.token',
  ],
  transport: prettyTransport(),
});
