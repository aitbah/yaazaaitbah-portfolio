# Skills, Technologies and Tools API

Three resources, one shape. A **skill** is a capability or a methodology (System
Architecture, Problem Solving); a **technology** is a language, framework or store
(TypeScript, React, PostgreSQL); a **tool** is software you operate (Git, Docker, Figma).

| Kind       | Resource            | Plural in the envelope | Single in the envelope |
| ---------- | ------------------- | ---------------------- | ---------------------- |
| skill      | `/api/skills`       | `skills`               | `skill`                |
| technology | `/api/technologies` | `technologies`         | `technology`           |
| tool       | `/api/tools`        | `tools`                | `tool`                 |

Three resources rather than one endpoint with a `?kind=` filter: a filter that can be
omitted is a mixed list waiting to be returned by accident. Everything below is written
against `/api/technologies`; the other two behave identically apart from the differences
listed under **What each kind allows**.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## The row

```json
{
  "id": "507f1f77bcf86cd799439022",
  "kind": "technology",
  "name": { "en": "TypeScript", "ar": "تايب سكريبت" },
  "category": "language",
  "level": 80,
  "icon": { "kind": "preset", "value": "typescript" },
  "order": 0,
  "updatedAt": "2026-09-02T10:00:00.000Z"
}
```

| Field       | Notes                                                                                                                                                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`      | Localized. `en` is required; any other locale may be added by sending it, with no schema change (see `DATABASE.md`)                                                                                                                                                                |
| `kind`      | `skill`, `technology` or `tool`. Set by the route, never by the body: `/api/tools` can only create a tool. Returned even though the resource already says it, because the project picker offers technologies and tools in one list and groups them by it                           |
| `category`  | **A code, never a label** - the frontend owns the wording. Which codes are valid depends on the kind; see **What each kind allows**                                                                                                                                                |
| `level`     | Proficiency as a whole-number percentage, `0`–`100`. Required: `0` is a real answer, so a default would hide the field never being filled in                                                                                                                                       |
| `icon`      | The brand logo, or absent. Either `{ "kind": "preset", "value": "<slug>" }` naming a vendored mark, or `{ "kind": "upload", "value": "/uploads/expertise/…" }`. A discriminated union, so "both at once" cannot be represented. **Not part of the skill shape at all** - see below |
| `order`     | Display position, lowest first. Optional on write, defaults to `0`. There is no reorder UI yet, so it is settable only through this API                                                                                                                                            |
| `updatedAt` | ISO date                                                                                                                                                                                                                                                                           |

`createdAt` and `__v` are never exposed.

### What each kind allows

| Kind       | Categories                                                                                                                                                                                                                                    | Logo                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| skill      | `engineering`, `architecture`, `quality`, `security`, `operations`, `data`, `ai`, `design`, `product`, `delivery`, `leadership`, `collaboration`, `communication`, `other`                                                                     | **None.** `POST /api/skills/icon` does not exist, and an `icon` in the body is refused with `NOT_ALLOWED` |
| technology | `language`, `frontend`, `backend`, `mobile`, `desktop`, `database`, `data-engineering`, `ai`, `cloud`, `infrastructure`, `messaging`, `api`, `testing`, `security`, `embedded`, `game`, `blockchain`, `other`                                   | Yes                                                                                                      |
| tool       | `editor`, `terminal`, `versioning`, `ci-cd`, `containers`, `infrastructure`, `monitoring`, `devops`, `testing`, `api`, `database`, `security`, `design`, `collaboration`, `project-management`, `documentation`, `ai`, `analytics`, `productivity`, `other` | Yes                                                                                                      |

A category belonging to another kind is refused with `INVALID_VALUE`. This is a schema
rule on both sides of the wire, not a convention the admin form follows.

Some codes appear under more than one kind, and deliberately: Security is a capability, a
field of technology _and_ a class of tool. Which of them a given row may hold is decided by
its `kind`, not by the spelling, and the overlap is declared in
`SHARED_EXPERTISE_CATEGORIES` - an _undeclared_ overlap fails a test, because that is a
category that has drifted onto a kind nobody meant it for.

**Codes are only ever added.** A code that has shipped is a contract with the rows holding
it: removing one strands them on a value nothing will validate again, on a page nobody
opens until the day they do. `tool.devops` is kept for exactly that reason now that
`ci-cd`, `containers` and `infrastructure` name the specific cases.

There is no `simple-icons` mark for "Data Analysis", so a skill has no logo field rather
than a field that could never be filled. Sending one is refused by name rather than
silently dropped: a client that sent it has a bug, and stripping the key would leave it
undiagnosed.

**Uniqueness.** Two rows _of the same kind_ cannot share a `name.en`; a unique index on
`{ kind, name.en }` enforces it, so a duplicate is refused even under concurrent writes.
Scoped to the kind because a tool called `Testing` and a skill called `Testing` are two
different claims. Other locales are not constrained - translations of one row are not a
second row.

**Ordering.** Each kind is its own list: sorted by `order` ascending then `name.en`, and
reordered independently. `PUT /api/technologies/reorder` must name every technology and
nothing else - an id belonging to another kind is refused as `STALE`.

**Logos.** A preset's `value` is a _slug_, never markup: the drawing is vendored in the
shared package and looked up by name, which is what lets the portfolio show vector logos
while SVG upload stays refused (see `SECURITY.md`). An unknown slug is rejected with
`INVALID_VALUE`, so nothing can be stored that would later render as a blank square. The
set is broad, not complete - several well known marks were removed upstream after
trademark requests, which is what `POST /api/technologies/icon` and
`POST /api/tools/icon` are for.

**No pagination.** A portfolio has tens of these, and `API-RULES.md` says to impose
pagination only where it provides real value.

The endpoint still answers with every row. What the admin and the public site do is **show** them a step at a time, which is display rather than paging.

---

## GET `/api/technologies`

Returns every technology, in display order.

**Public endpoint.** The portfolio's own pages display them, so no session is
required.

### Success

**HTTP 200**

```json
{
  "code": "SUCCESS",
  "details": {
    "technologies": [
      {
        "id": "507f1f77bcf86cd799439022",
        "name": { "en": "TypeScript" },
        "kind": "technology",
        "category": "language",
        "level": 80,
        "order": 0,
        "updatedAt": "2026-09-02T10:00:00.000Z"
      }
    ]
  }
}
```

An empty portfolio answers `200` with `"technologies": []`. That is a state, not a failure -
unlike `GET /api/profile`, which answers `NOT_FOUND` because there is no profile to show.

---

## POST `/api/technologies`

Creates a technology.

**Protected.** Requires the admin session cookie.

### Request

```json
{
  "name": { "en": "TypeScript" },
  "category": "language",
  "level": 80,
  "order": 0
}
```

`order` may be omitted and defaults to `0`.

### Success

**HTTP 200** - `details.technology`, the created row.

### Errors

| Code               | HTTP | When                                                                              |
| ------------------ | ---- | --------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                                                  |
| `VALIDATION_ERROR` | 422  | See the field codes below                                                         |
| `CONFLICT`         | 409  | `{ "name.en": "ALREADY_EXISTS" }` - a row of this kind already has that `name.en` |

---

## PUT `/api/technologies/:id`

Replaces a row. **Protected.**

The whole document is replaced rather than merged, as `PUT` implies: an omitted optional
field is cleared, and `order` returns to `0` if not sent.

### Errors

| Code               | HTTP | When                                                                                                                                                               |
| ------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UNAUTHENTICATED`  | 401  | No valid session                                                                                                                                                   |
| `NOT_FOUND`        | 404  | No technology has that id - including one that exists as a _skill_ or a _tool_, because the kind is part of the filter - **or the id is not an identifier at all** |
| `VALIDATION_ERROR` | 422  | See the field codes below                                                                                                                                          |
| `CONFLICT`         | 409  | The new `name.en` belongs to another row of this kind                                                                                                              |

---

## DELETE `/api/technologies/:id`

Deletes a row. **Protected.**

### Success

**HTTP 200**, with empty `details`.

### Errors

| Code              | HTTP | When                                                      |
| ----------------- | ---- | --------------------------------------------------------- |
| `UNAUTHENTICATED` | 401  | No valid session                                          |
| `NOT_FOUND`       | 404  | No technology has that id, or the id is not an identifier |

**A row a project still uses cannot be deleted.** The request answers `409 CONFLICT`
with `{ "<kind>": "IN_USE", "projects": <count> }` - the key is the kind you asked to
delete - and the row survives. Cascading the
removal would change what those projects display without anyone seeing it happen - the
admin never opened them. Unlink it from each project first.

The count is read before the delete and the two are not atomic, so a project could start
using it in between. That race only ever widens towards refusing a delete that
would have been fine, never towards leaving a project pointing at nothing.

---

## Validation codes

| Field           | Code                    | Meaning                                                                                                                                                                                                         |
| --------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | `REQUIRED`              | Absent, or not an object                                                                                                                                                                                        |
| `name.en`       | `REQUIRED`              | Missing or blank in the launch locale                                                                                                                                                                           |
| `name.<locale>` | `TOO_BIG`               | Longer than 60 characters                                                                                                                                                                                       |
| `name.en`       | `ALREADY_EXISTS`        | Another row of this kind already has that name. Sent with `CONFLICT`, not `VALIDATION_ERROR` - reported at `name.en` because that is the path the unique index covers and the one a client renders an input for |
| `category`      | `REQUIRED`              | Not sent                                                                                                                                                                                                        |
| `category`      | `INVALID_VALUE`         | Sent, but not one of the six categories                                                                                                                                                                         |
| `level`         | `REQUIRED`              | Not sent, or not a number - a numeric **string** is not accepted, so a form must convert first                                                                                                                  |
| `level`         | `INVALID_INTEGER`       | A fraction. Distinct from `REQUIRED` on purpose: the value is present and is a number                                                                                                                           |
| `level`         | `TOO_SMALL` / `TOO_BIG` | Outside `0`–`100`                                                                                                                                                                                               |
| `order`         | `TOO_SMALL`             | Negative                                                                                                                                                                                                        |
| `order`         | `INVALID_INTEGER`       | A fraction                                                                                                                                                                                                      |
| `name`          | `INVALID_KEY`           | A key that is not a locale tag. MongoDB cannot store a map key containing `.` or starting with `$`, so such a request is refused here rather than failing later as a server error                               |

`category` distinguishes "you did not choose" from "that is not a category" on purpose:
`z.enum` alone reports both as the same issue, which would have made an untouched form
say `INVALID_VALUE` where every other field says `REQUIRED`.

`level` makes the same distinction for the same reason. A fraction fails as a _type_
error in Zod, which would otherwise collapse to `REQUIRED` and put "this field is
required" under a box holding a visible value.

**Locale keys** must look like locale tags - `en`, `ar`, `pt-BR`. This is not decoration:
a MongoDB map key cannot contain a dot or begin with `$`, so without the rule the request
passed validation and then failed inside the storage layer, which the error handler could
only report as `SERVER_ERROR` - a client mistake dressed up as a server fault.

---

## PUT `/api/technologies/reorder`

Writes a whole ordering. **Protected.**

```json
{ "ids": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"] }
```

The **complete** list, in the order it should appear - not the pair that moved. Two tabs
each moving a different row would otherwise interleave into an order neither asked for.
Positions are rewritten from `0` with no gaps, and **nothing else about a row changes**
except `updatedAt`.

| Code               | HTTP | When                                                                                                                           |
| ------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| `UNAUTHENTICATED`  | 401  | No valid session                                                                                                               |
| `VALIDATION_ERROR` | 422  | `{{ "order": "DUPLICATE" }}` - the same id appears twice                                                                       |
| `CONFLICT`         | 409  | `{{ "order": "STALE" }}` - the list does not match what is stored, so the client is working from a page that has since changed |

Nothing is written unless the whole list is acceptable.

---

## POST `/api/technologies/icon`

**Auth:** required. Uploads a custom logo, for a mark the vendored preset set does not
carry.

### Request

The file is the whole body - no multipart, so no client filename is ever sent. Declare it
with `Content-Type: image/png`, `image/jpeg` or `image/webp`.

The declared type only chooses the parser; the stored extension comes from the file's own
signature bytes. **SVG is refused**, as it is on every upload endpoint.

### Success

```json
{
  "code": "SUCCESS",
  "details": { "iconUrl": "/uploads/expertise/icon-3f2a....png" }
}
```

The path is not attached to any row until a `POST`/`PUT` sends it as
`icon: { "kind": "upload", "value": "<path>" }`. An upload that is never saved leaves a
file nothing references; `npm run uploads:prune` collects it.

### Errors

| Status    | Code                | Details                         | When                                 |
| --------- | ------------------- | ------------------------------- | ------------------------------------ |
| 401       | `UNAUTHENTICATED`   | - | No session                           |
| 413 / 422 | `VALIDATION_ERROR`  | `{ "icon": "IMAGE_TOO_LARGE" }` | Over 2 MB                            |
| 422       | `VALIDATION_ERROR`  | `{ "icon": "INVALID_IMAGE" }`   | Not a PNG, JPEG or WebP by signature |
| 429       | `TOO_MANY_REQUESTS` | - | More than 20 uploads in 15 minutes   |
