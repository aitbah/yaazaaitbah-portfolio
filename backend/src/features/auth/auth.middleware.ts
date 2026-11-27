import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { toAuthenticatedUser } from './auth.service.js';
import { readSessionClaims } from './auth.session.js';
import { UserModel } from './user.model.js';

/**
 * The account a request's session names, or null.
 *
 * A still-valid token for a deleted account must not identify anyone, and
 * neither must one issued before the user's sessions were revoked - so the
 * token alone is never enough, in either middleware below.
 */
async function sessionUser(req: Request) {
  const claims = await readSessionClaims(req);
  const user = await UserModel.findById(claims.userId);

  if (!user || user.tokenVersion !== claims.tokenVersion) {
    return null;
  }

  return toAuthenticatedUser(user);
}

/**
 * Guards admin routes. It belongs to the auth feature rather than to core/,
 * because it depends on the User model - core must stay free of feature logic.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const user = await sessionUser(req);

  if (!user) {
    throw new ApiError(ResponseCode.UNAUTHENTICATED);
  }

  req.user = user;

  next();
}

/**
 * Identifies the reader where a session is optional, so a public route can
 * answer the owner more fully. No session, or a dead one, is an anonymous
 * reader, not a 401.
 */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const user = await sessionUser(req);

    if (user) {
      req.user = user;
    }
  } catch {
    // Absent or unreadable session: anonymous, which is allowed here.
  }

  next();
}
