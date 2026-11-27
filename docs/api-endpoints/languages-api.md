# Languages API

Read and manage the languages the portfolio's owner speaks.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## The language

```json
{
  "id": "507f1f77bcf86cd799439099",
  "code": "fr",
  "level": "c1",
  "order": 2,
  "updatedAt": "2026-09-05T10:00:00.000Z"
}
```

| Field       | Notes                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| `code`      | A BCP-47 primary subtag, from the curated list. **A code, never a label**                  |
| `level`     | One of `a1`, `a2`, `b1`, `b2`, `c1`, `c2`, `native`. A code                                |
| `order`     | Display position, lowest first. Written through the reorder endpoint, not through `PUT`    |
| `updatedAt` | ISO date                                                                                   |

`createdAt` and `__v` are never exposed.

### There is no name, and that is deliberate

Every other code list in this project pairs a code with a translated label. That does not
scale here: there are around 180 living languages with a subtag, and writing 180 labels -
then rewriting them for every locale added - is a translation project rather than a feature.

`Intl.DisplayNames` already knows every subtag's name **in the reader's own locale**, so the
name is rendered rather than stored. That is also the more correct answer for a multilingual
site: a stored English "German" is wrong on a French page, and a stored localized map would
have to be filled in by hand per language per locale.

A client receives `"fr"` and decides what to call it. The admin renders the same list as
"Arabic, French, English" in English and "arabe, français, anglais" in French, from
identical data.

The offered list is **curated rather than exhaustive**, because a select nobody can scan is
not a picker. It is mostly two-letter ISO 639-1, with `zgh` - Standard Moroccan Tamazight
has no two-letter subtag, and is not a language this portfolio can leave out.

### The level is CEFR

`a1` … `c2`, plus `native`. The CEFR levels mean the same thing to a reader in any country,
where "fluent" and "conversational" are claims whose scale the reader has to guess at.
`native` is not a CEFR level and is included deliberately: it is the one thing CEFR cannot
express and every CV states.

**Uniqueness.** A language is listed once or not at all - a unique index on `code`. Unlike a
credential there is no second instance to record: two rows for French is a mistake in every
case.

**Ordering.** By `order`, then `code`. This is the **only** one of the four newest sections
that has an `order`: a language list has no date to sort by, and alphabetical order would
put Arabic before English for reasons nobody intends. The owner decides what to lead with.

---

## GET `/api/languages`

Returns every language, in the stored order.

**Public endpoint.** The portfolio's own pages display them, so no session is required.

### Success

**HTTP 200** - `details.languages`, an array. Nothing listed answers `200` with `[]`.

---

## POST `/api/languages`

Creates a language. **Protected.** Requires the admin session cookie.

### Request

```json
{ "code": "fr", "level": "c1" }
```

`order` may be sent but is normally omitted: a new row goes to the back, and the ordering is
written through its own endpoint.

### Success

**HTTP 200** - `details.language`, the created language.

### Errors

| Code               | HTTP | When                                                                |
| ------------------ | ---- | --------------------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                                    |
| `VALIDATION_ERROR` | 422  | `{ "code": "INVALID_VALUE" }` or `{ "level": "INVALID_VALUE" }`     |
| `CONFLICT`         | 409  | `{ "code": "CODE_TAKEN" }` - that language is already listed        |

---

## PUT `/api/languages/:id`

Replaces a language. **Protected.**

### Errors

| Code               | HTTP | When                                                          |
| ------------------ | ---- | --------------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                              |
| `NOT_FOUND`        | 404  | No language has that id, or the id is not an identifier       |
| `VALIDATION_ERROR` | 422  | As above                                                      |
| `CONFLICT`         | 409  | The new code belongs to another row                           |

---

## PUT `/api/languages/reorder`

Writes a whole ordering. **Protected.** Declared before the `:id` routes, so `reorder` is
never read as an identifier.

### Request

```json
{ "ids": ["507f...99", "507f...98"] }
```

The **complete** list, not the pair that moved: two tabs each moving a different row would
otherwise interleave into an order neither asked for.

### Errors

| Code               | HTTP | When                                                                              |
| ------------------ | ---- | ----------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                                                  |
| `VALIDATION_ERROR` | 422  | `{ "order": "DUPLICATE" }` - the same id twice - or a malformed body               |
| `CONFLICT`         | 409  | `{ "order": "STALE" }` - the ids no longer match what is stored                    |

---

## DELETE `/api/languages/:id`

Deletes a language. **Protected.**

| Code              | HTTP | When                                                    |
| ----------------- | ---- | ------------------------------------------------------- |
| `UNAUTHENTICATED` | 401  | No valid session                                        |
| `NOT_FOUND`       | 404  | No language has that id, or the id is not an identifier |
