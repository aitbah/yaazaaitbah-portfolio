# Security

## Authentication (confirmed scope)

- Single **Admin** account for now - no visitor accounts, no multi-role system, no public registration.
- The `User` entity still exists in the data model to allow future evolution (see `DATABASE.md`), but only one admin user is created/used at this stage.
- Authentication with **JWT**, stored in an **HttpOnly + Secure** cookie.
- Passwords hashed with **Argon2**.
- **A new password is at least 12 characters** (`MIN_PASSWORD_LENGTH` in `shared`). Length only - composition rules push people towards `Password1!`, which is weaker than a longer phrase. The rule applies everywhere a password is *set*: `admin:create`, `admin:password` and `PUT /api/auth/password`. Login checks only that one was sent, so a wrong password answers `INVALID_CREDENTIALS` rather than leaking the policy.
- **Changing a password requires the current one**, even though the session already identifies the caller: a stolen cookie must not be enough to lock the owner out. The new hash and the revocation of every existing session are one update.
- **Sessions are revocable.** `tokenVersion` is checked on every request, so signing out, changing a password and `POST /api/auth/revoke` all invalidate tokens that are still within their lifetime.
- Admin routes/actions protected; public vs protected endpoints clearly distinguished.
- **"Is anyone signed in?" is answered, not refused.** `GET /api/auth/session` is public and returns `user: null` without a session; `GET /api/auth/me` stays protected and answers 401, which is what proves a revoked cookie no longer works.

## General Rules

- **CORS** properly configured.
- **Rate limiting**, especially on authentication endpoints.
- Security headers in place - on **both** servers:
  - The API sets them through `helmet`.
  - The frontend sets them in `next.config.ts`: `frame-ancestors 'none'` and
    `X-Frame-Options: DENY` (the admin session cookie rides along inside a frame, so
    framing is a live clickjacking surface), `nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, a `Permissions-Policy` that grants no hardware,
    and `poweredByHeader: false`.
  - **A full policy on the admin**, set in `src/proxy.ts` because the path decides whether it
    applies: `script-src 'self' 'nonce-…' 'sha256-…' 'strict-dynamic'`, plus `default-src 'self'`,
    `object-src 'none'`, `base-uri 'self'` and `form-action 'self'`. The nonce is generated per
    request and set on the *request* as well as the response - Next reads the incoming header
    to decide whether to nonce the scripts it emits, and without that the policy would ship a
    nonce matching nothing and the admin would render blank.
    - The one `'sha256-…'` is the **theme script's**, hashed in `proxy.ts` from the constant the
      root layout renders. It lives in the root layout so not-found and error pages get the
      reader's theme, and the root layout must not read the nonce header or every public page
      would render per request. CSP honours a hash beside a nonce and `strict-dynamic`.
    - The admin layout calls `connection()`: Next nonces its own scripts only when it renders the
      page for that request, so a prerendered admin would ship scripts the policy blocks.
    - `'unsafe-eval'` is added **in development only**, for Turbopack and React Refresh. That
      difference is the one thing the end-to-end suite cannot check, because it runs against
      the dev server.
    - `style-src` keeps `'unsafe-inline'`: 564 violations without it, from Tailwind and Next
      themselves. An inline style is not an inline script, and nonce-ing styles is a far
      larger job for a far smaller gain.
    - `img-src` allows `https:` because `photoReference` still permits an external URL, and no
      allow-list can name a host chosen at runtime.
  - **The public site keeps the baseline only** - `frame-ancestors`, `nosniff`,
    `Referrer-Policy`, `Permissions-Policy`. It holds no session and renders no visitor's
    text, so the script policy stays the admin's; extending it would be one line in the same
    middleware.
  - Framing, MIME sniffing and referrer leakage are closed for both.
  - Asserted end to end against a real response, not read from the config: a header that
    never reaches the wire is exactly the failure the test is for. For the script policy that
    means four things checked on **one** response - the nonce is present, the scripts carry
    the *same* nonce, every inline script is either nonced or admitted by a hash in the policy
    (the theme script's, matched against what is actually rendered), and a second request gets
    a different nonce.
- All user input validated with **Zod**.
- Never expose passwords, JWTs, API keys, secrets, or sensitive internal details in an API response, error, or log.
- Secrets and environment values (JWT secret, MongoDB URI, API keys, storage credentials) must never be committed:
  - `.env` contains real values (ignored by Git);
  - `.env.example` contains only variable names/placeholders.

## Personal Data on a Public Endpoint (confirmed scope)

`GET /api/profile` is public, and the profile carries details that must not be.

- **Publication is a stored choice, never an assumption.** The email and the location
  each carry a flag that defaults to *not published*. A detail becomes visible only
  because someone said so.
- **The API applies the filter**, not the client. An unpublished detail is **absent from
  the response**, not present and empty: a client cannot be trusted to withhold what it
  was sent, and a key that exists still says the field does.
- The rule lives in `shared` (`publicContactDetails`) so both sides point at one
  function, and the response mapper takes an explicit `audience` with **no default** - a
  caller that has not decided who is asking does not compile.
- The route identifies its reader through `attachUser` rather than `requireAuth`:
  requiring a session would make a public endpoint private, and a stale session must read
  as a stranger rather than answer 401 on a page everyone can see.
- Proved end to end against a real anonymous request, not by reading the mapper - the
  same reason the security headers are.

Storing an address the public site never shows is a useful state, not a contradiction:
the contact form is how a stranger writes, and it works whether or not the address is on
the page.

## Contact Form Protection (confirmed scope)

The public contact form must be protected against spam and abuse. Required from the start:

- Rate limiting on the contact endpoint.
- Strict input validation (Zod).
- Input sanitization.
- Honeypot field / basic anti-bot protection.
- Protection against repeated/rapid submissions from the same source.

**CAPTCHA is not required for now** - it can be added later if the project starts receiving real spam.

## Uploaded Images (confirmed scope)

- **The bytes decide what a file is.** The declared `Content-Type` only chooses the body parser; the extension a file is stored under comes from its own signature. A client filename never reaches the disk - the server generates the name.
- Image metadata (EXIF above all, which routinely carries GPS coordinates) is stripped on the way in, because uploads are served publicly.
- Uploads are served with `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; img-src 'self'; sandbox`. The signature check should mean nothing scriptable is ever in that directory; these decide what happens if that is ever wrong.
- Every upload endpoint authenticates **before** parsing, so no unauthenticated request is ever buffered, and each is separately rate limited.
- **A rate limiter goes behind the auth check, never in front of it.** Counting requests that were never going to be allowed hands an anonymous flood the power to spend the owner's allowance and lock them out of their own form - a denial of service delivered by the thing meant to prevent one. The upload routes had it the other way round until a sweep found them; both orders answer every request identically until the twenty-first, which is why nothing had noticed. `upload-rate-limit.test.ts` is what notices now.

### Documents: the resume

The CV is the one non-image file the application stores, and it is handled by the same
rule with its own answers:

- **A separate detector and a separate parser.** "Which image is this" and "which file is
  this" are different questions. Merging them would make every image endpoint accept a
  PDF by omission, so `detectDocumentExtension` is its own function, `application/pdf` is
  its own parser with its own size limit, and an endpoint accepts documents only if it
  says so.
- **`%PDF-`, from the bytes.** The declared `Content-Type` still only chooses the parser.
- **Nothing parses the PDF.** No metadata is stripped, because stripping it would mean
  adding a PDF library - an attack surface - to inspect a file the application never
  renders.
- **Served as an attachment.** `Content-Disposition: attachment` on the `resume` category,
  and only on it. Uploads already carry `nosniff` and `default-src 'none'; sandbox`, but a
  PDF asks a question those do not answer: the browser's own viewer is a plugin, and
  "render this in a tab from our origin" is not something a CV needs. Handed over instead,
  a stored PDF has no path to rendering here at all - and a download is what the reader
  wanted anyway.
- **Never an external URL.** Unlike a photo, a resume reference must be one of our own
  stored paths: a link to someone else's host would have none of the headers above.

### SVG is never accepted

SVG is XML that can carry script, and it would be served from our own origin - a stored XSS with the same-origin privileges of the admin.

**Skill logos do not weaken this.** A preset logo is stored as a *slug* (`react`, `laravel`) naming a drawing vendored in the shared package and looked up by name. No SVG supplied by a user is ever stored, served or parsed, and an unknown slug is refused by validation, so nothing can be saved that would later render as a blank square. Custom logos, for the marks the vendored set does not carry, upload as PNG/JPEG/WebP through the same signature check as every other image.

That is the trade: vector logos without vector uploads.
