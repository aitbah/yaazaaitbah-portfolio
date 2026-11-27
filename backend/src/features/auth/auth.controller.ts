import type { Request, Response } from 'express';

import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { sendSuccess } from '../../core/http/respond.js';
import { logger } from '../../core/logging/logger.js';
import {
  authenticate,
  changeEmail,
  changePassword,
  revokeSessions,
} from './auth.service.js';
import {
  clearSession,
  issueSession,
  peekSessionClaims,
} from './auth.session.js';
import {
  emailChangeSchema,
  loginSchema,
  passwordChangeSchema,
} from './auth.validation.js';

export async function login(req: Request, res: Response) {
  const credentials = loginSchema.parse(req.body);
  const { user, tokenVersion } = await authenticate(credentials);

  await issueSession(res, { userId: user.id, tokenVersion });
  logger.info({ userId: user.id }, 'Admin logged in');

  return sendSuccess(res, { user });
}

/**
 * Public on purpose: clearing a cookie is harmless and must work when the
 * session has already expired. When one is still valid it is also revoked, so
 * the token cannot be replayed for the rest of its lifetime.
 */
export async function logout(req: Request, res: Response) {
  const claims = await peekSessionClaims(req);

  if (claims) {
    await revokeSessions(claims.userId);
  }

  clearSession(res);

  return sendSuccess(res);
}

/** The signed-in account, or UNAUTHENTICATED - `requireAuth` guarantees one. */
function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(ResponseCode.UNAUTHENTICATED);
  }

  return req.user;
}

/**
 * Changes the password and re-issues this session, so this tab stays signed in
 * while every other session ends.
 */
export async function putPassword(req: Request, res: Response) {
  const { id } = requireUser(req);
  const input = passwordChangeSchema.parse(req.body);
  const tokenVersion = await changePassword(id, input);

  await issueSession(res, { userId: id, tokenVersion });
  logger.info({ userId: id }, 'Admin password changed');

  return sendSuccess(res);
}

/**
 * Changes the sign-in address and re-issues this session; the revocation ends a
 * thief's session too. The account is returned, since the client cannot derive
 * the new address.
 */
export async function putEmail(req: Request, res: Response) {
  const { id } = requireUser(req);
  const input = emailChangeSchema.parse(req.body);
  const tokenVersion = await changeEmail(id, input);

  await issueSession(res, { userId: id, tokenVersion });
  // The address itself is not logged: it is the account's identity, and the
  // log is the one place it would sit in plain text outside the database.
  logger.info({ userId: id }, 'Admin email changed');

  return sendSuccess(res, {
    user: { ...requireUser(req), email: input.newEmail },
  });
}

/**
 * Signs out every *other* session - the laptop left at the office, the phone
 * that was sold. The same mechanism a password change uses, for the case a
 * password change is not what is wanted.
 */
export async function postRevoke(req: Request, res: Response) {
  const { id } = requireUser(req);
  const tokenVersion = await revokeSessions(id);

  // Deleted between the guard and the write; there is nothing to sign back in
  // as. Signing *out* tolerates this on purpose - see `revokeSessions`.
  if (tokenVersion === null) {
    throw new ApiError(ResponseCode.UNAUTHENTICATED);
  }

  await issueSession(res, { userId: id, tokenVersion });
  logger.info({ userId: id }, 'Other sessions revoked');

  return sendSuccess(res);
}

export function me(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(ResponseCode.UNAUTHENTICATED);
  }

  return sendSuccess(res, { user: req.user });
}

/**
 * Whether anyone is signed in, answered rather than refused: the admin asks on
 * every load, and "nobody" is an expected answer there, not an error.
 */
export function session(req: Request, res: Response) {
  return sendSuccess(res, { user: req.user ?? null });
}
