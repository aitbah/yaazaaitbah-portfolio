# Options API

Read and manage the lists behind every dropdown in the admin.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## What an option is

Nine dropdowns were, until this pass, frozen arrays in `shared/src/validation-rules.ts`
paired with a message key per code in `frontend/messages/{en,fr}/admin.json`. Adding an
employment type meant a code change, two translations and a deploy - not something the
person whose CV this is should have to ask for.

They are rows now, in one collection, keyed by which list they belong to.

```json
{
  "id": "507f1f77bcf86cd799439099",
  "list": "social-platform",
  "code": "bluesky",
  "name": { "en": "Bluesky", "fr": "Bluesky" },
  "group": "social",
  "icon": "bluesky",
  "order": 12,
  "updatedAt": "2026-09-07T10:00:00.000Z"
}
```

| Field       | Notes                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| `list`      | Which dropdown. One of the nine below - the one part of a list that stays in code       |
| `code`      | **What stored rows hold.** Lowercase, digits and single dashes. Fixed at creation       |
| `name`      | Localized. The default locale is required; any other may be added beside it             |
| `group`     | The heading this option sits under, as a code. Only on `social-platform`                |
| `icon`      | A vendored brand slug. Only on `social-platform`                                        |
| `order`     | Display position, lowest first. Written through the reorder endpoint, not through `PUT` |
| `updatedAt` | ISO date                                                                                |

`createdAt` and `__v` are never exposed.

### The lists

| Key                     | Feeds                                           |
| ----------------------- | ----------------------------------------------- |
| `availability-status`   | `profile.contact.availability`                  |
| `skill-category`        | `expertise.category` where `kind: "skill"`      |
| `technology-category`   | `expertise.category` where `kind: "technology"` |
| `tool-category`         | `expertise.category` where `kind: "tool"`       |
| `employment-type`       | `experience.employmentType`                     |
| `education-level`       | `education.level`                               |
| `language-level`        | `language.level`                                |
| `social-platform`       | `socialLink.platform`                           |
| `social-platform-group` | the headings the platform picker groups under   |

Which list a kind of expertise reads is _not_ editable: `OPTION_LIST_BY_KIND` says a skill
draws from `skill-category`, and that is the whole point of the expertise split.

### A code cannot be changed

Rows reference an option by its **code string**, not by its identifier. That is what let
every row already stored stay valid the day the lists were seeded, with no migration at all,
and it is what keeps the shape of every other endpoint unchanged.

The price is paid here: renaming a code would strand every row holding it on a value nothing
will validate again. So `POST` takes a code, `PUT` refuses one, and the admin form shows it
disabled while editing.

The **name** is editable in every locale, and renaming an option relabels every row that
already holds it - which is the useful half of the trade.

### Three lists are deliberately absent

- **Language codes.** Identifiers rather than labels: `Intl.DisplayNames` renders each in the
  reader's own locale, so nothing about their names is stored. Turning them into rows would
  mean hand-typing names that are already known, and a third locale would then show English.
- **Expertise kinds and credential kinds.** Not options - API resources (`/api/skills`),
  routes (`/admin/tools`) and sidebar entries. A dynamic kind is a dynamic route.
- **Brand icon slugs.** A vendored drawing set; a slug with no drawing behind it renders
  nothing, so `optionIcon` still refuses one.

---

## GET `/api/options`

Returns every option, ordered by list, then by position, then by name.

**Public endpoint.** The portfolio's own pages show an employment type and a language level,
and a label is not a secret. Writing is the owner's alone.

### Query

| Parameter | Notes                                          |
| --------- | ---------------------------------------------- |
| `list`    | Optional. One list key; anything else is a 422 |

The admin's forms ask for **all** of them: nine dropdowns spread over six screens sharing one
cached answer is fewer requests than one query per dropdown, and the whole payload is smaller
than a single photograph.

### Success

**HTTP 200** - `details.options`, an array. Nothing stored answers `200` with `[]`.

### Errors

| Code               | HTTP | When                          |
| ------------------ | ---- | ----------------------------- |
| `VALIDATION_ERROR` | 422  | `list` names no declared list |

---

## POST `/api/options`

Creates an option. **Protected.** Requires the admin session cookie.

### Request

```json
{
  "list": "social-platform",
  "code": "bluesky",
  "name": { "en": "Bluesky" },
  "group": "social",
  "icon": "bluesky"
}
```

`order` may be sent but is normally omitted: a new row goes to the back, and the ordering is
written through its own endpoint.

`group` and `icon` are **refused outright** on the eight lists that have neither. Silently
dropping them would let a client believe it had set a heading on an education level.

### Success

**HTTP 200** - `details.option`, the created option.

### Errors

| Code               | HTTP | When                                                                          |
| ------------------ | ---- | ----------------------------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                                              |
| `VALIDATION_ERROR` | 422  | `{ "code": "INVALID_CODE" }`, `{ "name.en": "REQUIRED" }`                     |
| `VALIDATION_ERROR` | 422  | `{ "group": "NOT_ALLOWED" }` / `{ "icon": "NOT_ALLOWED" }` - not on this list |
| `VALIDATION_ERROR` | 422  | `{ "group": "INVALID_VALUE" }` - no heading has that code                     |
| `CONFLICT`         | 409  | `{ "code": "ALREADY_EXISTS" }` or `{ "name.en": "ALREADY_EXISTS" }`           |

Two unique indexes cover this collection - `{ list, code }` and `{ list, name.<default> }` -
and the conflict is reported at whichever field the admin actually typed in - with its own
code, because "that name is already taken" under a field labelled **Code** contradicts the
label directly above it.

---

## PUT `/api/options/:id`

Replaces everything an edit may touch, which is everything but the code. **Protected.**

### Request

```json
{ "list": "education-level", "name": { "en": "Bachelor", "fr": "Licence" } }
```

The `list` is part of the **filter**, not of the update: moving an option to another list
would strand the rows holding its code exactly as renaming the code would, so an id from
another list reads as "no such option".

### Errors

| Code               | HTTP | When                                                     |
| ------------------ | ---- | -------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                         |
| `NOT_FOUND`        | 404  | Nothing in that list has that id, or the id is malformed |
| `VALIDATION_ERROR` | 422  | `{ "code": "NOT_ALLOWED" }` - a code cannot be edited    |
| `VALIDATION_ERROR` | 422  | As `POST`, otherwise                                     |
| `CONFLICT`         | 409  | The new name belongs to another option in the list       |

---

## PUT `/api/options/reorder`

Writes a whole ordering, **within one list**. **Protected.** Declared before the `:id`
routes, so `reorder` is never read as an identifier.

### Request

```json
{ "list": "education-level", "ids": ["507f...99", "507f...98"] }
```

The **complete** list, not the pair that moved. Scoping to `list` is what makes that rule
mean the right thing: without it, an ordering of one list looks like an incomplete ordering
of all nine and is refused as stale.

### Errors

| Code               | HTTP | When                                                                 |
| ------------------ | ---- | -------------------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                                     |
| `VALIDATION_ERROR` | 422  | `{ "order": "DUPLICATE" }` - the same id twice - or a malformed body |
| `CONFLICT`         | 409  | `{ "order": "STALE" }` - the ids no longer match that list           |

---

## DELETE `/api/options/:id`

Deletes an option. **Protected.**

**Refused while a stored row still holds it**, the same rule expertise applies to a skill a
project uses. Cascading would change what those rows display without anyone seeing it happen,
and clearing the field would blank a value the owner chose.

A heading is "in use" by the options filed under it, not by content.

| Code              | HTTP | When                                                           |
| ----------------- | ---- | -------------------------------------------------------------- |
| `UNAUTHENTICATED` | 401  | No valid session                                               |
| `NOT_FOUND`       | 404  | No option has that id, or the id is not an identifier          |
| `CONFLICT`        | 409  | `{ "option": "IN_USE", "rows": 3 }` - three rows still hold it |

---

## Filling the lists in

```bash
docker compose exec backend npm run db:options
```

Separate from `db:seed`, which also writes example content: the lists are infrastructure
every install needs, and demonstration profiles and projects are not. It is safe to run on a
database that already has real content in it - every write is `$setOnInsert`, so a second run
adds whatever is new and never undoes a renamed label or a reordered list.
