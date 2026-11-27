# Auth API

Authentication endpoints for the single Admin account.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

Responses return machine-readable codes, never translated text.

## Session

Authentication uses a JWT stored in an `HttpOnly` + `Secure` + `SameSite=Lax` cookie named `session`.

- Algorithm: HS256
- Lifetime: 12 hours
- Cookie name: `session`
- Token is never exposed to JavaScript.
- Browser clients must send credentialed requests:

```ts
fetch('/api/auth/session', {
  credentials: 'include',
});
```

---

## POST `/api/auth/login`

Authenticates the Admin account and creates a session.

**Public endpoint.**

Rate limited to 10 attempts per 15 minutes per IP.

### Request

```json
{
  "email": "admin@example.com",
  "password": "..."
}
```

### Validation

Input is validated with Zod.

- `email` must be a valid email address.
- `password` must be non-empty.

The account password policy is not enforced during login. This ensures that an incorrect password returns `INVALID_CREDENTIALS` instead of exposing password-policy information.

### Success

**HTTP 200**

The response sets the `session` cookie.

```json
{
  "code": "SUCCESS",
  "details": {
    "user": {
      "id": "...",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

### Errors

| Code | HTTP | Description |
|---|---:|---|
| `VALIDATION_ERROR` | 422 | Request body is malformed |
| `INVALID_CREDENTIALS` | 401 | Email does not exist or password is incorrect |
| `TOO_MANY_REQUESTS` | 429 | Login rate limit exceeded |

Unknown emails and incorrect passwords intentionally return the same response to prevent account enumeration.

---

## POST `/api/auth/logout`

Clears the current authentication session.

**Public endpoint.**

Clearing an already expired or missing cookie is harmless, so authentication is not required.

### Success

**HTTP 200**

```json
{
  "code": "SUCCESS",
  "details": {}
}
```

The `session` cookie is cleared.

---

## GET `/api/auth/me`

Returns the currently authenticated Admin.

**Protected endpoint.**

Requires a valid `session` cookie.

For a caller that must be signed in. The admin checks for a session with `GET /api/auth/session` below, which answers "nobody" without an error.

### Success

**HTTP 200**

```json
{
  "code": "SUCCESS",
  "details": {
    "user": {
      "id": "...",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

### Errors

| Code | HTTP | Description |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Session cookie is missing, invalid, tampered with, expired, or the account no longer exists |

---

## GET `/api/auth/session`

Who is signed in, if anyone. The frontend asks this on every admin load to decide between the dashboard and the login page.

**Public endpoint.**

A missing, invalid, expired or revoked session is not an error here: it answers `user: null` with HTTP 200, so the login page does not log a failed request on every visit.

### Success

**HTTP 200**

```json
{
  "code": "SUCCESS",
  "details": {
    "user": {
      "id": "...",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

With no valid session:

```json
{
  "code": "SUCCESS",
  "details": { "user": null }
}
```

---

## Admin Account Creation

There is intentionally **no public registration endpoint**.

The initial Admin account is created once using the command line:

```bash
docker compose exec \
  -e ADMIN_EMAIL=you@example.com \
  -e ADMIN_PASSWORD='at-least-12-chars' \
  backend npm run admin:create
```

Credentials are passed directly to the command so they do not need to be stored in `.env`.

The password is hashed with **Argon2id** before being stored in MongoDB.

Running the command again with an existing email returns:

```text
CONFLICT
```

---

## PUT `/api/auth/password`

Changes the password. **Protected.** Requires the admin session cookie.

Until this endpoint existed there was no way to change a password at all. The account form
used to say `admin:create` was the way back in; it is not, because that script inserts and the
unique index on the address refuses an account that already exists. `npm run admin:password`
is the real recovery path, and it was written the day this was.

### Request

```json
{ "currentPassword": "...", "newPassword": "..." }
```

**The current password is required even though the session already says who is asking.** A
stolen session cookie must not be enough to lock the owner out of their own site, and asking
for the current password is what makes the cookie insufficient on its own.

The policy applies to the **new** password only: at least 12 characters, at most 200. Length
alone - composition rules push people towards `Password1!`, which is weaker than a longer
phrase. `MIN_PASSWORD_LENGTH` lives in `@portfolio/shared`, so the form applies the same
minimum the server enforces rather than teaching it through a round trip.

Login still checks only that a password was *sent*. Enforcing the policy there would answer a
wrong password with `VALIDATION_ERROR` instead of `INVALID_CREDENTIALS` and leak the policy to
anyone guessing.

### What it does

The new hash and the session revocation are **one update**. A password changed without the old
sessions dying is the failure this endpoint exists to prevent, and two writes leave a window in
which that is exactly the state.

`tokenVersion` is bumped, which invalidates every token already issued - and the response then
re-issues a session for the caller. **The device that made the change stays signed in; every
other one does not.** That is the point rather than a convenience: a password change is exactly
when the other sessions should stop working, and signing the owner out of the screen they are
looking at would teach them to avoid doing it.

### Success

**HTTP 200**, with no `details`. The client already knows who it is; a body here could only
repeat it.

### Errors

| Code                  | HTTP | When                                                                 |
| --------------------- | ---- | ---------------------------------------------------------------------- |
| `UNAUTHENTICATED`     | 401  | No valid session                                                     |
| `INVALID_CREDENTIALS` | 401  | The current password is wrong - the same code login gives            |
| `VALIDATION_ERROR`    | 422  | `{ "newPassword": "TOO_SMALL" }` - shorter than the policy allows    |
| `VALIDATION_ERROR`    | 422  | `{ "newPassword": "UNCHANGED" }` - the new one *is* the current one  |
| `TOO_MANY_REQUESTS`   | 429  | Ten attempts in fifteen minutes                                      |

Rate-limited on the same terms as login, for the same attack one step further in: a stolen
session guessing the current password in order to change it. The limiter is applied **after**
`requireAuth` deliberately - ahead of it, an unauthenticated flood would consume the budget and
lock the owner out of their own password form.

**One budget, shared with `PUT /api/auth/email`.** It is one guess being limited - the current
password - and separate budgets would double the attempts available for the same question.

---

## PUT `/api/auth/email`

Changes the address the account signs in with. **Protected.** Requires the admin session
cookie.

### Request

```json
{ "currentPassword": "...", "newEmail": "..." }
```

**The current password is required**, for the reason the password change gives one step
further: a stolen session cookie must not be enough to take the account's *identity*.

### What it does

The address and the session revocation are **one update**, exactly as the password change is,
and the revocation matters more here - if the cookie was stolen, this is the endpoint the
thief wants, and the version bump is what ends their session too. The caller's session is
re-issued, so the device making the change stays signed in.

**The address already stored is refused rather than written.** The unique index cannot catch
that one: the row it would collide with is the account's own, so the write would succeed,
report a change that changed nothing, and revoke every session for it.

### Success

**HTTP 200**, with the account:

```json
{ "code": "SUCCESS", "details": { "user": { "id": "...", "email": "...", "role": "admin" } } }
```

Unlike the password change, which answers with nothing. The client cannot derive the new
address from what it holds - it is what the sidebar and the account page display - and a
refetch would only ask for what this response already carries.

### Errors

| Code                  | HTTP | When                                                                  |
| --------------------- | ---- | --------------------------------------------------------------------- |
| `UNAUTHENTICATED`     | 401  | No valid session                                                      |
| `INVALID_CREDENTIALS` | 401  | The current password is wrong - the same code login gives             |
| `VALIDATION_ERROR`    | 422  | `{ "newEmail": "INVALID_EMAIL" }` - not an address                     |
| `VALIDATION_ERROR`    | 422  | `{ "newEmail": "UNCHANGED" }` - the address already stored             |
| `CONFLICT`            | 409  | `{ "newEmail": "ALREADY_EXISTS" }` - another account holds it          |
| `TOO_MANY_REQUESTS`   | 429  | Ten attempts in fifteen minutes, shared with the password change       |

### There is no confirmation email

This project has no mail transport, so **the new address cannot be proved to exist**. A typo is
a lockout at the next sign-in. Three things answer that:

1. The form asks for the address **twice**, which catches the error that actually happens.
2. **`npm run admin:email`** changes it from the shell. Shell access to the machine is a
   strictly stronger credential than an inbox, so this stays the recovery path whatever mail
   the project grows later.
3. The current password is required, so a stolen cookie alone cannot do it.

A mailed verification link was considered and left out on purpose: it needs a token, an expiry
and a *public unauthenticated* endpoint - real attack surface for a single-account admin, in
exchange for a guarantee the shell already provides.

---

## POST `/api/auth/revoke`

Signs out every **other** session. **Protected.**

The same mechanism a password change uses, for the case a password change is not what is
wanted: a laptop left at an office, a phone that was sold. `tokenVersion` is bumped and the
caller's session is re-issued, so this device stays signed in and every other one is dropped.

### Success

**HTTP 200**, with no `details`.

### Errors

| Code              | HTTP | When                                                           |
| ----------------- | ---- | -------------------------------------------------------------- |
| `UNAUTHENTICATED` | 401  | No valid session, or the account was deleted mid-request       |

Signing *out* tolerates a deleted account and this does not: `POST /api/auth/logout` must clear
the cookie whether or not there is still an account behind it, while there is nothing to sign
back in as here.

---

## Protecting a Route

Admin-only routes use the authentication middleware:

```ts
import { requireAuth } from '../auth/auth.middleware.js';

router.post('/', requireAuth, createProject);
```

`requireAuth`:

1. Reads the `session` cookie.
2. Verifies the JWT signature.
3. Checks that the JWT is not expired.
4. Loads the corresponding user from MongoDB.
5. Rejects the request with `UNAUTHENTICATED` if authentication fails.
6. Populates `req.user` with:

```ts
{
  id: string;
  email: string;
  role: 'admin';
}
```

Passwords, password hashes, JWTs, and secrets must never be returned in API responses or logs.
