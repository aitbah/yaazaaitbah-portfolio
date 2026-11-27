# Experience API

Read and manage the portfolio's professional experience - the positions held at
organisations that make up a career.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## The position

```json
{
  "id": "507f1f77bcf86cd799439066",
  "role": { "en": "Backend Engineer" },
  "organisation": { "en": "Acme" },
  "location": { "en": "Casablanca, Morocco" },
  "employmentType": "full-time",
  "startDate": "2021-03",
  "endDate": "2023-06",
  "current": false,
  "description": { "en": "Order and inventory services." },
  "updatedAt": "2026-09-04T10:00:00.000Z"
}
```

| Field            | Notes                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role`           | Localized. `en` is required; any other locale may be added by sending it, with no schema change                                                                  |
| `organisation`   | Localized, required                                                                                                                                              |
| `location`       | Localized, optional. Absent rather than empty when it holds nothing                                                                                              |
| `employmentType` | One of `full-time`, `part-time`, `contract`, `freelance`, `self-employed`, `temporary`, `internship`, `apprenticeship`, `working-student`, `volunteer`. **A code, never a label** - the frontend owns the wording |
| `startDate`      | A month, as `YYYY-MM`. Required                                                                                                                                  |
| `endDate`        | A month. **Absent for a current position**, required otherwise                                                                                                   |
| `current`        | Whether the position is still held. Defaults to `false`                                                                                                          |
| `description`    | Localized, optional                                                                                                                                              |
| `updatedAt`      | ISO date                                                                                                                                                         |

`createdAt` and `__v` are never exposed.

### Months, not dates

A CV says "March 2021", not a timestamp. A `Date` would claim a precision the data does
not have, and would drag in a timezone bug: UTC midnight on the first, rendered at a
negative offset, is the _previous_ month.

`YYYY-MM` sorts lexicographically exactly as it sorts chronologically, compares directly
for the end-after-start rule, and cannot be shifted by an offset. A client rendering a
month name **must format in UTC** for the same reason.

### The period rules

The three date fields only make sense together, and are validated as a set. Every failure
is reported on `endDate`, because that is the field a client can act on:

| Situation                                    | Code           |
| -------------------------------------------- | -------------- |
| `current` is true and an `endDate` was sent  | `NOT_ALLOWED`  |
| `current` is false and no `endDate` was sent | `REQUIRED`     |
| `endDate` is before `startDate`              | `BEFORE_START` |

An end in the same month as the start is a position held for one month, not an error.

**Uniqueness.** The same role, at the same organisation, starting in the same month cannot
be entered twice; a compound unique index enforces it, so a duplicate is refused even
under concurrent writes. None of the three fields is constrained on its own: one role at
two employers, two roles at one employer and two stints at the same employer are all
legitimate careers. A duplicate is reported at `role.en`, the first field of the key and
one a client renders an input for.

**Ordering.** Most recent first - `startDate` descending, with `createdAt` as a
deterministic tie-break. **There is no `order` field and no reorder endpoint.** A career is
ordered by when things happened, and a stored position that disagreed with the dates would
be a state nobody could see. `PUT /api/experience/reorder` is read as an id, which is not
one, and answers `NOT_FOUND`.

**No pagination.** A career has tens of positions at most, and `API-RULES.md` says to
impose pagination only where it provides real value.

The endpoint still answers with every row. What the admin and the public site do is **show** them a step at a time, which is display rather than paging.

---

## GET `/api/experience`

Returns every position, most recent first.

**Public endpoint.** The portfolio's own pages display the career, so no session is
required.

### Success

**HTTP 200**

```json
{
  "code": "SUCCESS",
  "details": {
    "experience": [
      {
        "id": "507f1f77bcf86cd799439066",
        "role": { "en": "Backend Engineer" },
        "organisation": { "en": "Acme" },
        "employmentType": "full-time",
        "startDate": "2021-03",
        "endDate": "2023-06",
        "current": false,
        "updatedAt": "2026-09-04T10:00:00.000Z"
      }
    ]
  }
}
```

`experience` is a mass noun on purpose: "experiences" is not what a CV section is called,
and a key that reads wrong is worse than one that is not plural.

An empty career answers `200` with `"experience": []`. That is a state, not a failure.

---

## POST `/api/experience`

Creates a position. **Protected.** Requires the admin session cookie.

### Request

```json
{
  "role": { "en": "Backend Engineer" },
  "organisation": { "en": "Acme" },
  "employmentType": "full-time",
  "startDate": "2021-03",
  "endDate": "2023-06",
  "current": false
}
```

`current` may be omitted and defaults to `false`.

### Success

**HTTP 200** - `details.position`, the created position.

### Errors

| Code               | HTTP | When                                                                                               |
| ------------------ | ---- | -------------------------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                                                                   |
| `VALIDATION_ERROR` | 422  | A field is missing or invalid; see the field codes below                                           |
| `CONFLICT`         | 409  | `{ "role.en": "ALREADY_EXISTS" }` - that role, organisation and start month already exist together |

---

## PUT `/api/experience/:id`

Replaces a position. **Protected.**

`PUT` replaces rather than merges, so an omitted optional field is cleared - `endDate`
above all, since a position that becomes current must lose the end date it had.

### Errors

| Code               | HTTP | When                                                                  |
| ------------------ | ---- | --------------------------------------------------------------------- |
| `UNAUTHENTICATED`  | 401  | No valid session                                                      |
| `NOT_FOUND`        | 404  | No position has that id, **or the id is not an identifier at all**    |
| `VALIDATION_ERROR` | 422  | As above                                                              |
| `CONFLICT`         | 409  | The new role, organisation and start month belong to another position |

---

## DELETE `/api/experience/:id`

Deletes a position. **Protected.**

Nothing references a position, so there is no delete guard: unlike a technology, deleting
one cannot leave another document pointing at nothing.

### Errors

| Code              | HTTP | When                                                    |
| ----------------- | ---- | ------------------------------------------------------- |
| `UNAUTHENTICATED` | 401  | No valid session                                        |
| `NOT_FOUND`       | 404  | No position has that id, or the id is not an identifier |

---

## Field codes

| Field                        | Code                                        | Meaning                                                                                                      |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `role`, `organisation`       | `REQUIRED`                                  | Missing altogether                                                                                           |
| `role.en`, `organisation.en` | `REQUIRED`                                  | The launch locale is missing or blank                                                                        |
| `role.en`                    | `ALREADY_EXISTS`                            | That role, organisation and start month already exist together. Sent with `CONFLICT`, not `VALIDATION_ERROR` |
| `employmentType`             | `REQUIRED` / `INVALID_VALUE`                | Not chosen / not one of the types                                                                            |
| `startDate`, `endDate`       | `INVALID_MONTH`                             | Not a `YYYY-MM` month                                                                                        |
| `endDate`                    | `NOT_ALLOWED` / `REQUIRED` / `BEFORE_START` | See the period rules above                                                                                   |
