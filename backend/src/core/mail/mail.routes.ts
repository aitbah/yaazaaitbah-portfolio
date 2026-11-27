import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { requireAuth } from '../../features/auth/auth.middleware.js';
import { ApiError } from '../http/api-error.js';
import { sendSuccess } from '../http/respond.js';
import { ResponseCode } from '../http/response-codes.js';
import { mailSettings, sendTestMail } from './mailer.js';

const TEST_WINDOW_MS = 15 * 60 * 1000;
const TEST_MAX_SENDS = 5;

/**
 * A budget on the test send, against a stuck page or a retry loop making the
 * provider think this host sends spam. After `requireAuth`, so an anonymous
 * flood cannot spend it.
 */
export const mailTestRateLimit = rateLimit({
  windowMs: TEST_WINDOW_MS,
  limit: TEST_MAX_SENDS,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new ApiError(ResponseCode.TOO_MANY_REQUESTS));
  },
});

export const mailRouter = Router();

/**
 * What the admin may know about the transport - never the credentials.
 *
 * Protected, though everything it returns is the owner's own configuration:
 * the host and port of a mail server are a hint about the stack, and there is
 * no reader for them who is not signed in.
 */
mailRouter.get('/status', requireAuth, (_req, res) =>
  sendSuccess(res, { mail: mailSettings() }),
);

/**
 * Sends a fixed test message and reports the outcome; here the send is the
 * request, so a failure is an error. `SERVICE_UNAVAILABLE` either way, with the
 * reason in `details`.
 */
mailRouter.post('/test', requireAuth, mailTestRateLimit, async (_req, res) => {
  const settings = mailSettings();

  if (!settings.configured) {
    throw new ApiError(ResponseCode.SERVICE_UNAVAILABLE, {
      mail: 'NOT_CONFIGURED',
    });
  }

  if (!(await sendTestMail())) {
    throw new ApiError(ResponseCode.SERVICE_UNAVAILABLE, {
      mail: 'SEND_FAILED',
    });
  }

  return sendSuccess(res, { sentTo: settings.notifyTo });
});
