# Education API

Read and manage what the portfolio's owner studied - the qualifications earned at
institutions.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## The entry

```json
{
  "id": "507f1f77bcf86cd799439077",
  "institution": { "en": "Université Hassan II" },
  "qualification": { "en": "BSc Computer Science" },
  "fieldOfStudy": { "en": "Computer Science" },
  "level": "bachelor",
  "location": { "en": "Casablanca, Morocco" },
  "startDate": "2015-09",
  "endDate": "2018-06",
  "current": false,
  "description": { "en": "Algorithms, databases and networks." },
  "updatedAt": "2026-09-05T10:00:00.000Z"
}
```

| Field           | Notes                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `institution`   | Localized. `en` is required; any other locale may be added by sending it, with no schema change                                                                          |
| `qualification` | Localized, required. What the certificate says                                                                                                                           |
| `fieldOfStudy`  | Localized, optional. The subject, when the qualification's own wording does not name it                                                                                  |
| `level`         | One of `secondary`, `vocational`, `associate`, `bachelor`, `master`, `postgraduate`, `doctorate`, `bootcamp`, `other`. **A code, never a label** - the frontend owns the wording |
| `location`      | Localized, optional. Absent rather than empty when it holds nothing                                                                                                     |
| `startDate`     | A month, as `YYYY-MM`. Required                                                                                                                                          |
| `endDate`       | A month. **Absent while the course is under way**, required otherwise                                                                                                    |
| `current`       | Whether it is still being studied. Defaults to `false`                                                                                                                   |
| `description`   | Localized, optional                                                                                                                                                      |
| `updatedAt`     | ISO date                                                                                                                                                                 |

`createdAt` and `__v` are never exposed.

### The level, beside the qualification

The same arrangement `employmentType` has beside `role` in the experience API: the code is
what a public page can badge, filter and translate, and the qualification beside it is the
exact wording a reader recognises.

The list covers how people in this industry actually studied, including the routes that are
not a university. A vocational course and a bootcamp are real educations, and filing them
under `other` would make `other` the commonest answer - which is how a code list stops
being one.

### Months, and the period rules

Identical to the experience API's, because they are **the same rules**: `yearMonth` and
`checkPeriod` live in `shared` and both entities compose on them. A client rendering a
month name must format in UTC, for the reason `experience-api.md` sets out.

Every period failure is reported on `endDate`, because that is the field a client can act
on:

| Situation                                    | Code           |
| -------------------------------------------- | -------------- |
| `current` is true and an `endDate` was sent  | `NOT_ALLOWED`  |
| `current` is false and no `endDate` was sent | `REQUIRED`     |
| `endDate` is before `startDate`              | `BEFORE_START` |

**Uniqueness.** The same qualification, from the same institution, starting in the same
month cannot be entered twice; a compound unique index enforces it, so a duplicate is
refused even under concurrent writes. None of the three fields is constrained on its own:
one institution awards many qualifications, one qualification is awarded by many
institutions, and returning to the same course later is legitimate. A duplicate is reported
at `institution.en`, the first field of the key.

**Ordering.** Most recent first - `startDate` descending, with `createdAt` as a
deterministic tie-break, so a course still under way stays above one that ended in the same
month it started. **There is no `order` field and no reorder endpoint**, for the reason a
career has none. `PUT /api/education/reorder` is read as an id, which is not one, and
answers `NOT_FOUND`.

**No pagination.** A history of study has a handful of entries at most.

The endpoint still answers with every row. What the admin and the public site do is **show** them a step at a time, which is display rather than paging.

---

## GET `/api/education`

Returns every entry, most recent first.

**Public endpoint.** The portfolio's own pages display it, so no session is required.

### Success

**HTTP 200**

```json
{
  "code": "SUCCESS",
  "details": {
    "education": [
      {
        "id": "507f1f77bcf86cd799439077",
        "institution": { "en": "Université Hassan II" },
        "qualification": { "en": "BSc Computer Science" },
        "level": "bachelor",
        "startDate": "2015-09",
        "endDate": "2018-06",
        "current": false,
        "updatedAt": "2026-09-05T10:00:00.000Z"
      }
    ]
  }
}
```

`education` is a mass noun on purpose, as `experience` is: "educations" is not what the
section is called, and a key that reads wrong is worse than one that is not plural.

Nothing studied answers `200` with `"education": []`. That is a state, not a failure.

---

## POST `/api/education`

Creates an entry. **Protected.** Requires the admin session cookie.

### Request

```json
{
  "institution": { "en": "Université Hassan II" },
  "qualification": { "en": "BSc Computer Science" },
  "level": "bachelor",
  "startDate": "2015-09",
  "endDate": "2018-06",
  "current": false
}
```

`current` may be omitted and defaults to `false`.

### Success

**HTTP 200** - `details.entry`, the created entry.

### Errors

| Code               | HTTP | When                                                                                                              |
| ------------------ | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `UNAUTHENTICATED`  | 401  | No valid session                                                                                                  |
| `VALIDATION_ERROR` | 422  | A field is missing or invalid; see the field codes below                                                          |
| `CONFLICT`         | 409  | `{ "institution.en": "ALREADY_EXISTS" }` - that institution, qualification and start month already exist together |

---

## PUT `/api/education/:id`

Replaces an entry. **Protected.**

`PUT` replaces rather than merges, so an omitted optional field is cleared - `endDate`
above all, since an entry that becomes current must lose the end date it had.

### Errors

| Code               | HTTP | When                                                                     |
| ------------------ | ---- | ------------------------------------------------------------------------ |
| `UNAUTHENTICATED`  | 401  | No valid session                                                         |
| `NOT_FOUND`        | 404  | No entry has that id, **or the id is not an identifier at all**          |
| `VALIDATION_ERROR` | 422  | As above                                                                 |
| `CONFLICT`         | 409  | The new institution, qualification and start month belong to another entry |

---

## DELETE `/api/education/:id`

Deletes an entry. **Protected.**

Nothing references an entry, so there is no delete guard: unlike a technology, deleting one
cannot leave another document pointing at nothing.

### Errors

| Code              | HTTP | When                                                 |
| ----------------- | ---- | ---------------------------------------------------- |
| `UNAUTHENTICATED` | 401  | No valid session                                     |
| `NOT_FOUND`       | 404  | No entry has that id, or the id is not an identifier |

---

## Field codes

| Field                              | Code                                        | Meaning                                                                                                                 |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `institution`, `qualification`     | `REQUIRED`                                  | Missing altogether                                                                                                      |
| `institution.en`, `qualification.en` | `REQUIRED`                                | The launch locale is missing or blank                                                                                   |
| `institution.en`                   | `ALREADY_EXISTS`                            | That institution, qualification and start month already exist together. Sent with `CONFLICT`, not `VALIDATION_ERROR`    |
| `level`                            | `REQUIRED` / `INVALID_VALUE`                | Not chosen / not one of the levels                                                                                      |
| `startDate`, `endDate`             | `INVALID_MONTH`                             | Not a `YYYY-MM` month                                                                                                   |
| `endDate`                          | `NOT_ALLOWED` / `REQUIRED` / `BEFORE_START` | See the period rules above                                                                                              |
