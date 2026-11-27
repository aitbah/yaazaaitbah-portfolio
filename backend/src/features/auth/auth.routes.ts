import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import {
  login,
  logout,
  me,
  postRevoke,
  putEmail,
  putPassword,
  session,
} from './auth.controller.js';
import { attachUser, requireAuth } from './auth.middleware.js';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export const loginRateLimit = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_MAX_ATTEMPTS,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Rejections go through the centralized error handler like any other failure.
  handler: (_req, _res, next) => {
    next(new ApiError(ResponseCode.TOO_MANY_REQUESTS));
  },
});

/**
 * The login limit's shape, for a stolen session guessing the current password;
 * one budget for both forms. After `requireAuth`, so an anonymous flood cannot
 * lock the owner out.
 */
export const passwordRateLimit = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_MAX_ATTEMPTS,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new ApiError(ResponseCode.TOO_MANY_REQUESTS));
  },
});

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
authRouter.get('/session', attachUser, session);
authRouter.put('/password', requireAuth, passwordRateLimit, putPassword);
authRouter.put('/email', requireAuth, passwordRateLimit, putEmail);
authRouter.post('/revoke', requireAuth, postRevoke);
