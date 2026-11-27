import { createHash } from 'node:crypto';

import { hasLocale } from 'next-intl';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { THEME_SCRIPT } from './components/theme/theme';
import { routing } from './i18n/routing';
import { API_ORIGIN } from './lib/api-client';
import { readFromApi } from './lib/server-api';

const handleI18nRouting = createMiddleware(routing);

const SESSION_COOKIE = 'session';
const ADMIN_SEGMENT = 'admin';
const LOGIN_SEGMENT = 'login';

// Presence only: the backend owns the signing secret and enforces the real check.
function needsSession(pathname: string) {
  const [, , area, page] = pathname.split('/');

  return area === ADMIN_SEGMENT && page !== LOGIN_SEGMENT;
}

function isAdminArea(pathname: string) {
  return pathname.split('/')[2] === ADMIN_SEGMENT;
}

/**
 * The theme script, admitted by its hash beside the nonce. It is rendered by
 * the root layout, which serves pages outside the admin and so does not read
 * the nonce; hashed from the rendered constant, so the two cannot drift.
 */
const THEME_SCRIPT_HASH = `'sha256-${createHash('sha256').update(THEME_SCRIPT).digest('base64')}'`;

/**
 * The admin's script policy. The admin renders text strangers wrote (the inbox)
 * with a session in scope; React's escaping keeps that safe, and this keeps it
 * safe if something else fails.
 *
 * - A nonce with `strict-dynamic` admits Next's scripts; without the nonce,
 *   all of them are blocked.
 * - `'unsafe-eval'` in development only, for Turbopack and React Refresh.
 * - `style-src` keeps `'unsafe-inline'`: Tailwind and Next rely on inline
 *   styles.
 * - `img-src` allows `https:`, since a photo may be an external URL.
 * - `connect-src` names the API only when it is a separate origin.
 */
function adminPolicy(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    THEME_SCRIPT_HASH,
    // Lets the nonced entry scripts load the chunks they import, without
    // every chunk needing its own nonce.
    "'strict-dynamic'",
    ...(process.env.NODE_ENV === 'production' ? [] : ["'unsafe-eval'"]),
  ].join(' ');

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self' ${API_ORIGIN}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Already sent for every route by `next.config.ts`; repeated because a
    // policy is enforced per header, and this one must stand on its own.
    "frame-ancestors 'none'",
  ].join('; ');
}

/** `/<locale>/projects/<slug>`: the one public route whose existence is data. */
const PROJECT_PATH = /^\/([^/]+)\/projects\/([^/]+)\/?$/;

/**
 * An address inside the locale that no route matches - which
 * `global-not-found.tsx` answers with a real 404 page.
 */
const UNMATCHED_SEGMENT = '__not-found__';

/**
 * A missing project, answered before any page renders. A `notFound()` thrown
 * while rendering arrives as Next's unstyled error shell; rewriting to an
 * unmatched address serves `global-not-found.tsx` instead, as a real 404 page.
 * If the API cannot be read, the page decides, so an outage never makes every
 * project missing.
 */
async function missingProjectRewrite(request: NextRequest) {
  const match = PROJECT_PATH.exec(request.nextUrl.pathname);

  if (!match) {
    return null;
  }

  const [, locale = '', encodedSlug = ''] = match;
  let slug: string;

  try {
    slug = decodeURIComponent(encodedSlug);
  } catch {
    return null;
  }

  if (!hasLocale(routing.locales, locale)) {
    return null;
  }

  const details = await readFromApi<{ projects: { slug: string }[] }>(
    '/api/projects',
  );

  if (!details || details.projects.some((project) => project.slug === slug)) {
    return null;
  }

  // What next-intl's own middleware would have told the page: the locale this
  // request is in, so the not-found page answers in the reader's language.
  const headers = new Headers(request.headers);
  headers.set('X-NEXT-INTL-LOCALE', locale);

  return NextResponse.rewrite(
    new URL(`/${locale}/${UNMATCHED_SEGMENT}`, request.url),
    { request: { headers } },
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (needsSession(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const [, locale] = pathname.split('/');
    const loginUrl = new URL(
      `/${locale}/${ADMIN_SEGMENT}/${LOGIN_SEGMENT}`,
      request.url,
    );

    return NextResponse.redirect(loginUrl);
  }

  // Public responses keep the baseline from `next.config.ts`; the script
  // policy is the admin's, where a session is in scope.
  if (!isAdminArea(pathname)) {
    return (await missingProjectRewrite(request)) ?? handleI18nRouting(request);
  }

  const nonce = crypto.randomUUID();
  const policy = adminPolicy(nonce);

  /**
   * Set on the request as well as the response: Next reads the incoming policy
   * to decide whether to nonce its script tags.
   */
  request.headers.set('x-nonce', nonce);
  request.headers.set('content-security-policy', policy);

  const response = handleI18nRouting(request);

  response.headers.set('content-security-policy', policy);

  return response;
}

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
