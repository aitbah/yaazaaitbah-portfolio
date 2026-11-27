# Credentials API - Certifications and Courses

Read and manage the portfolio's credentials. **Two resources from one entity**, separated
by a required `kind`:

| Kind            | Resource                | Envelope           |
| --------------- | ----------------------- | ------------------ |
| `certification` | `/api/certifications`   | `certifications`   |
| `course`        | `/api/courses`          | `courses`          |

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## Why one entity, when Education and Experience are two

The rule this project follows: share a collection when the shapes are **exactly** the same,
and split when the fields that differ are the ones every screen renders.

Experience and Education differ where it shows - an employment type and a role against a
level and a qualification - so they are separate entities. A certification and a course do
not differ at all: both are *issued by somebody, on a date, with a name, optionally
verifiable at a URL*. Only the word for the issuer's act separates them, and that is what
a `kind` is for.

So this follows the expertise precedent, and the separation is enforced the same way:

- `kind` is **required, with no default, and set by the route** - `/api/courses` can only
  ever create a course, so no body can name one kind and land in the other list.
- The API is **two resources**, not one with a `?kind=` filter that could be omitted.
- **Uniqueness is per kind**: a course and a certification may share a name.
- An id belonging to the other kind answers `NOT_FOUND` on `PUT` and `DELETE` rather than
  being quietly reachable.

## The credential

```json
{
  "id": "507f1f77bcf86cd799439088",
  "kind": "certification",
  "name": { "en": "AWS Certified Developer – Associate" },
  "issuer": { "en": "Amazon Web Services" },
  "issuedAt": "2024-04",
  "expiresAt": "2027-04",
  "credentialId": "AWS-DVA-2024-4417",
  "credentialUrl": "https://www.credly.com/badges/example",
  "description": { "en": "..." },
  "updatedAt": "2026-09-05T10:00:00.000Z"
}
```

| Field           | Notes                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `kind`          | `certification` or `course`. Carried even though the resource says it, because a client may hold both lists |
| `name`          | Localized. `en` is required                                                                     |
| `issuer`        | Localized, required. The awarding body, platform or institution                                 |
| `issuedAt`      | A month, as `YYYY-MM`. Required                                                                 |
| `expiresAt`     | A month. **Absent means it does not expire** - never that it is still under way                 |
| `credentialId`  | Optional. What the issuer printed on it. **Not localized**: an identifier is not prose           |
| `credentialUrl` | Optional `http(s)` URL - the issuer's own verification page                                     |
| `description`   | Localized, optional                                                                             |
| `updatedAt`     | ISO date                                                                                        |

`createdAt` and `__v` are never exposed.

### A point in time, not a period

This is why the credential does **not** reuse the period rules that Experience and Education
share:

- there is no `current` - a credential is not something you are still doing;
- an absent `expiresAt` means "does not expire", where an absent `endDate` means "still
  under way";
- **an expiry in the past is not an error.** An expired certification is a true fact about
  someone's history, and a validator that refused it would be refusing the truth. The admin
  marks it expired instead, and the public site will be able to do the same.

The one rule that does carry over is that an expiry cannot precede the issue, because that
is not a fact about anything. It is reported on `expiresAt` as `BEFORE_ISSUE`.

An expiry **in the same month as the issue** is a credential valid for one month, not an
error - and a credential is valid *during* the month it expires in.

### Verification is a link, never an upload

A certificate lives on the issuer's site, and that is the version worth linking: it is
verifiable, it stays current, and it costs no storage. `credentialUrl` goes through the same
`externalUrl` rule every other link does, so `javascript:`, `data:` and `file:` are refused
before anything is stored.

**Uniqueness.** Within one kind, the same name from the same issuer in the same month cannot
be entered twice; a compound unique index on `{ kind, name.en, issuer.en, issuedAt }`
enforces it, so a duplicate is refused even under concurrent writes. Earning the same
credential again on a later date is legitimate and allowed. A duplicate is reported at
`name.en`.

**Ordering.** Most recently issued first - `issuedAt` descending, `createdAt` as a
deterministic tie-break. **There is no `order` field and no reorder endpoint.**

**No pagination.** A CV carries a handful of credentials.

The endpoint still answers with every row. What the admin and the public site do is **show** them a step at a time, which is display rather than paging.

---

## GET `/api/certifications` · GET `/api/courses`

Returns that kind's credentials, most recently issued first.

**Public endpoint.** The portfolio's own pages display them, so no session is required.

### Success

**HTTP 200** - the list under the resource's own name:

```json
{
  "code": "SUCCESS",
  "details": {
    "certifications": [
      {
        "id": "507f1f77bcf86cd799439088",
        "kind": "certification",
        "name": { "en": "AWS Certified Developer – Associate" },
        "issuer": { "en": "Amazon Web Services" },
        "issuedAt": "2024-04",
        "expiresAt": "2027-04",
        "updatedAt": "2026-09-05T10:00:00.000Z"
      }
    ]
  }
}
```

An empty list answers `200` with `[]`. That is a state, not a failure.

---

## POST `/api/certifications` · POST `/api/courses`

Creates a credential of that kind. **Protected.** Requires the admin session cookie.

`kind` in the body is **ignored**: the route decides it.

### Request

```json
{
  "name": { "en": "AWS Certified Developer – Associate" },
  "issuer": { "en": "Amazon Web Services" },
  "issuedAt": "2024-04",
  "expiresAt": "2027-04"
}
```

### Success

**HTTP 200** - `details.credential`, the created credential.

### Errors

| Code               | HTTP | When                                                                              |
| ------------------ | ---- | ----------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                                                  |
| `VALIDATION_ERROR` | 422  | A field is missing or invalid; see the field codes below                          |
| `CONFLICT`         | 409  | `{ "name.en": "ALREADY_EXISTS" }` - that name, issuer and issue month already exist for this kind |

---

## PUT `/api/certifications/:id` · PUT `/api/courses/:id`

Replaces a credential. **Protected.**

`PUT` replaces rather than merges, so an omitted optional field is cleared - `expiresAt`
above all, since a credential that stops expiring must lose the date it had.

The kind is part of the filter, so an id belonging to the other kind is **not reachable**.

### Errors

| Code               | HTTP | When                                                                                     |
| ------------------ | ---- | ------------------------------------------------------------------------------------------ |
| `UNAUTHENTICATED`  | 401  | No valid session                                                                         |
| `NOT_FOUND`        | 404  | No credential of **this kind** has that id, or the id is not an identifier at all         |
| `VALIDATION_ERROR` | 422  | As above                                                                                 |
| `CONFLICT`         | 409  | The new name, issuer and issue month belong to another credential of the same kind        |

---

## DELETE `/api/certifications/:id` · DELETE `/api/courses/:id`

Deletes a credential. **Protected.** Scoped to the kind, as `PUT` is.

### Errors

| Code              | HTTP | When                                                                        |
| ----------------- | ---- | --------------------------------------------------------------------------- |
| `UNAUTHENTICATED` | 401  | No valid session                                                            |
| `NOT_FOUND`       | 404  | No credential of this kind has that id, or the id is not an identifier      |

---

## Field codes

| Field                    | Code                         | Meaning                                                                             |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------- |
| `name`, `issuer`         | `REQUIRED`                   | Missing altogether                                                                  |
| `name.en`, `issuer.en`   | `REQUIRED`                   | The launch locale is missing or blank                                               |
| `name.en`                | `ALREADY_EXISTS`             | That name, issuer and issue month already exist for this kind. Sent with `CONFLICT` |
| `issuedAt`, `expiresAt`  | `INVALID_MONTH`              | Not a `YYYY-MM` month                                                               |
| `expiresAt`              | `BEFORE_ISSUE`               | The expiry precedes the issue                                                       |
| `credentialUrl`          | `INVALID_URL`                | Not an `http(s)` link                                                               |
| `credentialId`           | `TOO_BIG`                    | Longer than the cap                                                                 |
