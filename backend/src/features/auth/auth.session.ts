import type { Request, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';

import { env } from '../../config/env.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';

const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const ALGORITHM = 'HS256';

const secret = new TextEncoder().encode(env.JWT_SECRET);

const cookieOptions = {
  httpOnly: true,
  // Browsers treat localhost as a secure origin, so this holds in development too.
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const;

export type SessionClaims = {
  userId: string;
  tokenVersion: number;
};

export async function issueSession(
  res: Response,
  { userId, tokenVersion }: SessionClaims,
) {
  const token = await new SignJWT({ tokenVersion })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);

  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

/** The caller's claims, or UNAUTHENTICATED - never a reason why. */
export async function readSessionClaims(req: Request): Promise<SessionClaims> {
  const claims = await peekSessionClaims(req);

  if (!claims) {
    throw new ApiError(ResponseCode.UNAUTHENTICATED);
  }

  return claims;
}

/**
 * The same read without the throw, for the one caller that must tolerate a
 * missing or expired session: signing out has to work either way.
 */
export async function peekSessionClaims(
  req: Request,
): Promise<SessionClaims | null> {
  const cookies = req.cookies as Record<string, string | undefined>;
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  try {
    // Pinning the algorithm prevents a forged token from choosing a weaker one.
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
    });

    if (typeof payload.sub !== 'string') {
      return null;
    }

    return {
      userId: payload.sub,
      tokenVersion:
        typeof payload.tokenVersion === 'number' ? payload.tokenVersion : -1,
    };
  } catch {
    // Expired, tampered with or malformed - all indistinguishable to the client.
    return null;
  }
}
