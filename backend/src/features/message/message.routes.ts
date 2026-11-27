import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  deleteMessage,
  getMessages,
  patchMessageRead,
  postMessage,
} from './message.controller.js';

const CONTACT_WINDOW_MS = 60 * 60 * 1000;
const CONTACT_MAX_PER_HOUR = 5;
const BURST_WINDOW_MS = 60 * 1000;
const BURST_MAX = 2;

function refuse(): (
  ...args: [unknown, unknown, (error: ApiError) => void]
) => void {
  return (_req, _res, next) => {
    next(new ApiError(ResponseCode.TOO_MANY_REQUESTS));
  };
}

/**
 * Two limits for two abuses: a burst from a script, and a slow drip. One window
 * cannot stop both without refusing a legitimate second message. Per address and
 * in memory - a single-process deployment.
 */
export const contactBurstLimit = rateLimit({
  windowMs: BURST_WINDOW_MS,
  limit: BURST_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Only accepted messages count: a visitor's rejected attempts must not use
  // up their allowance. A honeypot hit answers 200, so bots still count.
  skipFailedRequests: true,
  handler: refuse(),
});

export const contactHourlyLimit = rateLimit({
  windowMs: CONTACT_WINDOW_MS,
  limit: CONTACT_MAX_PER_HOUR,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipFailedRequests: true,
  handler: refuse(),
});

export const messageRouter = Router();

// The only public write in the application. Limited before it is validated or
// stored, so a flood costs the JSON parser (capped at 100 KB in app.ts) and the
// limiter's bookkeeping, and nothing more.
messageRouter.post('/', contactBurstLimit, contactHourlyLimit, postMessage);

messageRouter.get('/', requireAuth, getMessages);
messageRouter.patch('/:id/read', requireAuth, patchMessageRead);
messageRouter.delete('/:id', requireAuth, deleteMessage);
