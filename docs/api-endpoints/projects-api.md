# Projects API

Read and manage the portfolio's projects.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## The project

```json
{
  "id": "507f1f77bcf86cd799439022",
  "title": { "en": "Portfolio", "ar": "الموقع" },
  "description": { "en": "This site." },
  "skills": ["507f1f77bcf86cd799439011"],
  "imageUrl": "/uploads/project/cover-2b51d475.png",
  "imageAlt": { "en": "The project's home page" },
  "gallery": [
    { "url": "/uploads/project/gallery-9d1c4a02.png", "alt": { "en": "The dashboard" } },
    { "url": "/uploads/project/gallery-7ef2b118.png" }
  ],
  "role": { "en": "Built the sync layer" },
  "problem": { "en": "Two clients could write the same row while offline." },
  "approach": { "en": "Merged per field rather than last-write-wins." },
  "outcome": { "en": "Conflicts fell to none over a month." },
  "repoUrl": "https://github.com/me/repo",
  "liveUrl": "https://example.com",
  "featured": true,
  "order": 0,
  "updatedAt": "2026-09-02T10:00:00.000Z"
}
```

| Field | Notes |
|---|---|
| `title` | Localized. `en` required; any other locale may be added by sending it |
| `description` | Localized, same rule |
| `skills` | Identifiers of existing `Skill` documents. Optional - a project may have none yet. **Every id must exist**, or the write is refused |
| `imageUrl` | Optional cover. Either one of our own upload paths or an `http(s)` URL |
| `imageAlt` | Optional, localized. What the cover shows, for anyone who cannot see it. An empty alt is the correct answer for a decorative image |
| `gallery` | Screenshots beside the cover, at most 12. **Always present**, `[]` when empty, so a client never has to tell "no images" from "no field". Each entry is `{ url, alt? }`, with the same rules as the cover |
| `role` | Optional, localized. What the owner actually did - on a team project, the difference between being there and building the thing |
| `problem` | Optional, localized. What made it non-trivial. Not what the project does |
| `approach` | Optional, localized. The decision taken, and the obvious alternative rejected |
| `outcome` | Optional, localized. What changed. A number where there is one |
| `repoUrl`, `liveUrl` | Optional. `http(s)` **only** - unlike the cover, a link is never one of our own upload paths |
| `featured` | Boolean, default `false`. Featured projects sort first |
| `order` | Display position, lowest first. Optional on write, defaults to `0`. Settable only through this API - there is no reorder UI |
| `updatedAt` | ISO date |

`createdAt` and `__v` are never exposed. `imageUrl`, `imageAlt`, `role`, `problem`,
`approach`, `outcome`, `repoUrl` and `liveUrl` are omitted from the response when they are
not set; `gallery` never is.

### Why four narrow fields rather than one rich body

`title` and `description` say **what a thing is**. These four say **why it was hard**, which
is the question a reader is actually asking - and `approach`, the decision taken against the
obvious alternative, carries the most signal per word.

A free-form rich-text body was the alternative and was refused: it costs a sanitizer, an
editor and a rendering surface for stored HTML - the largest XSS surface a portfolio can have -
and a blank box invites a paragraph that says nothing, where four named fields ask four
questions.

**All four are optional**, and that matters more than the fields do. A project carrying only
a description still renders, and a field that forces a paragraph out of a weekend build
produces filler, which reads worse than absence.

**Gallery order is position.** There is no `order` field on an entry, and no reorder
endpoint. `PUT` replaces the whole gallery, so moving an image is sending the same
entries in a different sequence - an ordering cannot disagree with itself the way a list
of positions can.

**Removing an image deletes its file.** A write compares what the project referenced
before against what it references now, cover and gallery together, and deletes only what
is no longer referenced anywhere. Promoting a gallery image to the cover therefore keeps
its file, and so does reordering.

**Uniqueness.** Two projects cannot share a `title.en`; a unique index enforces it, so a
duplicate is refused even under concurrent writes. Other locales are unconstrained.

**Ordering.** Featured first, then `order` ascending, then `title.en`.

**No pagination**, for the same reason as skills.

The endpoint still answers with every row. What the admin and the public site do is **show** them a step at a time, which is display rather than paging.

---

## GET `/api/projects`

Returns every project, in display order. **Public endpoint.**

An empty portfolio answers `200` with `"projects": []` - a state, not a failure.

---

## POST `/api/projects`

Creates a project. **Protected.**

`skills`, `featured` and `order` may be omitted and default to `[]`, `false` and `0`.

| Code | HTTP | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `VALIDATION_ERROR` | 422 | See the field codes below |
| `CONFLICT` | 409 | `{ "title.en": "ALREADY_EXISTS" }` |

---

## PUT `/api/projects/:id`

Replaces a project. **Protected.**

The whole document is replaced rather than merged, as `PUT` implies: an omitted optional
field is cleared. Internally this is a `$set` of what was sent plus an `$unset` of what
was not, because a true replacement carries no `createdAt` and would silently reset the
project's creation date.

Changing `imageUrl` deletes the cover the project stops pointing at. An external URL is
never touched, and neither is an unchanged one.

| Code | HTTP | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `NOT_FOUND` | 404 | No project has that id, **or the id is not an identifier at all** |
| `VALIDATION_ERROR` | 422 | See below |
| `CONFLICT` | 409 | The new `title.en` belongs to another project |

---

## DELETE `/api/projects/:id`

Deletes a project **and its cover**, since nothing can point at it once the document is
gone. **Protected.**

---

## POST `/api/projects/image`

Uploads a cover and answers with the reference to persist. **Protected**, and rate limited
to 20 attempts per fifteen minutes.

Identical in shape to the profile photo upload - see `profile-api.md` for the full
reasoning. In short: the file **is** the request body, so no client filename ever exists;
the declared `Content-Type` only chooses the parser and the **bytes** decide what the file
actually is; SVG is rejected; the name is generated server-side; and image metadata is
stripped on the way in.

### Success

**HTTP 200** - `details.imageUrl`, e.g. `/uploads/project/cover-<uuid>.png`.

The reference is stored on a project only when the admin saves the form, so an upload that
is never saved leaves a file nothing points at. `npm run uploads:prune` reconciles both
categories.

| Code | HTTP | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session. Checked **before** any bytes are read |
| `VALIDATION_ERROR` | 422 | `{ "image": "INVALID_IMAGE" }` or `{ "image": "IMAGE_TOO_LARGE" }` |
| `TOO_MANY_REQUESTS` | 429 | Past the upload limit |

---

## Validation codes

| Field | Code | Meaning |
|---|---|---|
| `title`, `description` | `REQUIRED` | Absent, or not an object |
| `title.en`, `description.en` | `REQUIRED` | Missing or blank in the launch locale |
| `title.<locale>` | `TOO_BIG` | Longer than 120 characters (`description`: 2000) |
| `title`, `description` | `INVALID_KEY` | A key that is not a locale tag |
| `skills.<n>` | `INVALID_ID` | Not a 24-character identifier |
| `skills` | `NOT_FOUND` | One of the referenced skills does not exist |
| `imageUrl` | `INVALID_URL` | Not an upload path and not an `http(s)` URL |
| `repoUrl`, `liveUrl` | `INVALID_URL` | Not an `http(s)` URL - an upload path is rejected here too |
| `featured` | `REQUIRED` | Not a boolean |
| `order` | `TOO_SMALL` / `INVALID_INTEGER` | Negative, or a fraction |

---

## PUT `/api/projects/reorder`

Writes a whole ordering. **Protected.**

```json
{ "ids": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"] }
```

The **complete** list, in the order it should appear - not the pair that moved. Two tabs
each moving a different row would otherwise interleave into an order neither asked for.
Positions are rewritten from `0` with no gaps, and **nothing else about a row changes**
except `updatedAt`.

| Code | HTTP | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `VALIDATION_ERROR` | 422 | `{{ "order": "DUPLICATE" }}` - the same id appears twice |
| `CONFLICT` | 409 | `{{ "order": "STALE" }}` - the list does not match what is stored, so the client is working from a page that has since changed |

Nothing is written unless the whole list is acceptable.

---

## POST `/api/projects/gallery`

**Auth:** required. Identical in every respect to `POST /api/projects/image` - same body
contract, same signature check, same 2 MB cap, same limiter - except that it answers
under the field name `gallery`, so a rejected file lands on the control the admin was
actually using.

### Success

```json
{
  "code": "SUCCESS",
  "details": { "imageUrl": "/uploads/project/gallery-9d1c4a02.png" }
}
```

The path joins the project only when a `POST`/`PUT` sends it inside `gallery`. An upload
that is never saved leaves a file nothing references; `npm run uploads:prune` collects it.
