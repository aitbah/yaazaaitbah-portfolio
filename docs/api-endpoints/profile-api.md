# Profile API

Read and write the portfolio's single `Profile` document.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## The single profile

The portfolio has exactly one profile, and a constant `key` with a unique index makes
that structural rather than conventional: two concurrent upserts can no longer both
insert, because the database refuses the second. `key` is internal and never appears in
a response.

Localized fields are keyed by locale. `en` is required; any other locale may be added by
sending it, with no schema change (see `DATABASE.md`).

```json
{ "headline": { "en": "Full-stack developer", "ar": "مطور ويب" } }
```

### Images

The profile carries two, and they are **two images rather than two crops of one**: a
square portrait shown small beside a name, and a wide feature image composed for that
shape. Deriving either from the other would need an image library this project
deliberately does without.

| Field | Notes |
|---|---|
| `photoUrl` | The photograph. One of our own upload paths, or an `http(s)` URL |
| `photoAlt` | Optional, localized. What the photo shows |

It is uploaded through `POST /api/profile/photo`, which answers under the field name
`photo`. The profile carried a second, wide image until it was removed: one photograph is
what the site shows.

Alt text is optional throughout: an empty alt is the correct answer for a decorative
image, and a required one only teaches people to type "image".

`PUT` replaces the profile, so omitting an image field **clears it**, and the file the
profile stops pointing at is deleted. An `http(s)` URL is never touched.

### Contact details, and who may see them

The profile carries an optional `contact` block. Every detail in it is stored, and every
detail has a **flag beside it saying whether the public site may show it**.

| Field | Notes |
|---|---|
| `email` | An address. Not localized: an address is an identifier, not prose |
| `emailPublic` | Defaults to **false** |
| `location` | Optional, localized - a city has a name in each language |
| `locationPublic` | Defaults to **false** |
| `availability` | One of `open-to-work`, `open-to-freelance`, `open-to-collaboration`, `not-looking` |
| `availabilityPublic` | Defaults to **true**: a status exists in order to be seen |

An email on a public page is collected by scrapers within days, and a location is a fact
about where someone lives. Neither becomes visible because the profile happens to carry
it - which is a useful state rather than a contradiction, because the contact form
already lets a stranger write without the address being anywhere on the page.

**The filter is applied by the API, not by whatever renders the profile.** `GET` returns
only what the reader is allowed to see, and an unpublished detail is **absent from the
response** rather than present and empty - a key that exists still says the field does.

The reader is identified even though the route is public (`attachUser`): a signed-in
owner reads back everything, because the admin is where these are edited, and an expired
or revoked session reads as a stranger rather than as a 401 on a public page.

---

## GET `/api/profile`

Returns the profile.

**Public endpoint.** The portfolio's own public pages display it, so no session is
required.

### Success

**HTTP 200**

```json
{
  "code": "SUCCESS",
  "details": {
    "profile": {
      "firstName": { "en": "Yaaza" },
      "lastName": { "en": "Ait Bah" },
      "headline": { "en": "Full-stack developer" },
      "bio": { "en": "..." },
      "photoUrl": "https://cdn.example.com/me.jpg",
      "contact": {
        "location": { "en": "Casablanca, Morocco" },
        "emailPublic": false,
        "locationPublic": true,
        "availability": "open-to-freelance",
        "availabilityPublic": true
      },
      "updatedAt": "2026-08-30T10:00:00.000Z"
    }
  }
}
```

The content fields, plus `updatedAt` as an ISO date so the public site can show when the
profile last changed. The document's `_id`, `__v` and `createdAt` are never exposed: a
client addresses *the* profile, never one by identifier.

Optional fields are omitted from the response when they are not set - and so is any
contact detail this reader may not see. The example above is what an **anonymous** reader
receives from a profile that also stores an email: the address is absent because
`emailPublic` is false, while the flag itself stays, because a flag says nothing private.
A signed-in owner receives the same document with `email` included.

### Errors

| Code | HTTP | Description |
|---|---:|---|
| `NOT_FOUND` | 404 | No profile has been saved yet |

`NOT_FOUND` is an answer, not a failure - the same way `GET /api/auth/me` answers
`UNAUTHENTICATED` when nobody is signed in. A client maps it to "no profile yet".

---

## PUT `/api/profile`

Creates the profile, or replaces it if it already exists.

**Protected endpoint.** Requires a valid `session` cookie - see `auth-api.md`.

### Request

The complete profile. There is no partial update: **`PUT` replaces the document**, so an
omitted optional field is cleared.

```json
{
  "firstName": { "en": "Yaaza", "ar": "ياعزى" },
  "lastName": { "en": "Ait Bah" },
  "headline": { "en": "Full-stack developer" },
  "bio": { "en": "Building things for the web." },
  "photoUrl": "https://cdn.example.com/me.jpg"
}
```

### Validation

Input is validated with Zod, then the model's own validators run at persistence.

- `firstName`, `lastName`, `headline` - required, localized, `en` must be present and
  non-blank. Max 80 characters for the names, 160 for the headline.
- `bio` - optional, localized, max 2000 characters.
- `photoUrl` - optional. Either a path this application manages
  (`/uploads/<category>/<name>.<png|jpg|webp>`) or an absolute `http(s)` URL. Only the
  reference is persisted, never the image itself.

  Any other scheme is rejected, `javascript:`, `data:` and `file:` included: the value is
  rendered in a page, and `z.url()` alone accepts all three.

Every locale sent is validated like the launch locale: an added locale carrying a blank
string is rejected, not ignored.

### Success

**HTTP 200**, with the saved profile in the same shape as `GET` - `updatedAt` included,
reflecting the write that just happened. Creating and updating both answer 200; the
client has no reason to distinguish them.

### Errors

| Code | HTTP | Description |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Session cookie is missing, invalid or expired |
| `VALIDATION_ERROR` | 422 | Request body is malformed |

Validation details name the level that failed - the field when it is absent entirely,
the locale when only that locale is missing:

```json
{
  "code": "VALIDATION_ERROR",
  "details": { "firstName.en": "REQUIRED", "photoUrl": "INVALID_URL" }
}
```

Saving a profile whose photo changed deletes the file it stopped pointing at, but only
when that file is one this application stores. An external URL is never touched.

---

## POST `/api/profile/photo`

Stores an image and answers with the reference to put in `photoUrl`.

**Protected endpoint.** Requires a valid `session` cookie - see `auth-api.md`. Rate
limited to 20 uploads per 15 minutes.

### Request

The file is the **entire request body** - there is no multipart form, so no client
filename is ever sent and none is ever used.

```text
Content-Type: image/png | image/jpeg | image/webp
Body: the raw bytes
```

The declared `Content-Type` only selects the parser. What the file actually is comes from
its own signature bytes, so an SVG or a script announced as `image/png` is refused.

**SVG is never accepted**: it is XML that can carry script, and it would be served from
this application's own origin.

Maximum 2 MB, enforced before the request reaches the handler.

### Success

**HTTP 200**

```json
{
  "code": "SUCCESS",
  "details": { "photoUrl": "/uploads/profile/avatar-<uuid>.webp" }
}
```

The path is relative on purpose: an absolute URL would embed the environment's hostname in
the database and break on deployment. The filename is generated server-side from a random
identifier and the extension of the **detected** type.

Uploading does not change the profile. The path becomes the stored photo only when
`PUT /api/profile` is called with it, so an upload that is never saved leaves a file
nothing points at.

### Errors

| Code | HTTP | Description |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Session cookie is missing, invalid or expired |
| `VALIDATION_ERROR` | 422 | `{ "photo": "INVALID_IMAGE" }` or `{ "photo": "IMAGE_TOO_LARGE" }` |
| `TOO_MANY_REQUESTS` | 429 | Upload rate limit exceeded |

---

## POST `/api/profile/resume`

Stores a PDF and answers with the reference to put in `resume` under a locale.

**Protected endpoint.** Requires a valid `session` cookie. Rate limited on its own budget,
so uploading a CV does not spend the photo's.

### Request

The file is the **entire request body**, as for an image.

```text
Content-Type: application/pdf
Body: the raw bytes
```

The declared `Content-Type` only selects the parser: the file must begin `%PDF-`, or it is
refused. A separate detector from the images, so no image endpoint accepts a document and
this one accepts nothing else.

Maximum 5 MB, enforced before the request reaches the handler.

Nothing parses the PDF. Stripping its metadata would mean adding a PDF library - an attack
surface - to inspect a file the application never renders; it is served as an attachment
instead, which is what makes that safe.

### Success

**HTTP 200**

```json
{
  "code": "SUCCESS",
  "details": { "resumeUrl": "/uploads/resume/cv-<uuid>.pdf" }
}
```

As with a photo, uploading does not change the profile. The path becomes the stored resume
only when `PUT /api/profile` is called with it, under the locale it belongs to:

```json
{ "resume": { "en": "/uploads/resume/cv-<uuid>.pdf" } }
```

`resume` is localized because a CV really differs by language, unlike a photograph.
Unlike `photoUrl` it is **never an external URL**: it is served from our own uploads with
the headers that make it a download rather than a document the browser renders.

Saving a profile whose resume changed deletes the file it stopped pointing at, per locale -
replacing the English CV does not touch the French one, and clearing the field deletes
both.

### Errors

| Code | HTTP | Description |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Session cookie is missing, invalid or expired |
| `VALIDATION_ERROR` | 422 | `{ "resume": "INVALID_DOCUMENT" }` or `{ "resume": "DOCUMENT_TOO_LARGE" }` |
| `TOO_MANY_REQUESTS` | 429 | Upload rate limit exceeded |

---

## GET `/uploads/...`

Stored files are served as static assets. **Public**, cached for seven days and marked
immutable, since a filename is random and a file is never rewritten in place. Directory
listings and dotfiles are disabled.

These responses carry `Cross-Origin-Resource-Policy: cross-origin`, without which the
browser refuses to render them in the frontend, which runs on another origin.

Files under `/uploads/resume/` additionally carry `Content-Disposition: attachment`. A CV
is handed to the reader rather than opened in the browser's own viewer - see
`SECURITY.md`.
