# Database

## Identified Entities

`User`, `Profile`, `SocialLink`, `Project`, `Expertise`, `Experience`, `Education`, `Credential`, `Language`, `Message`, `Option`

Schemas are to be designed during implementation of each feature, not fixed in advance.

### `Profile` entity - one document, and one part of it that is not public

The portfolio has exactly one profile, addressed by a constant `key` with a unique index.

It carries an embedded `contact` subdocument: an email, a localized location, an
availability status, and **a visibility flag beside each of them**. The flags are stored
rather than derived, and they default to *not published* in the schema as well as in the
validation - a default that disagreed with the contract would be a way for a detail to
become public without anyone choosing it, which is the one failure this field exists to
prevent. `availabilityPublic` is the exception and defaults to true: a status exists in
order to be seen.

A subdocument rather than six top-level fields, because a flag only means anything beside
the value it gates. `_id: false`, because it is one embedded object and not a row.

`GET /api/profile` is public, so what a stranger receives is filtered by those flags -
see `SECURITY.md` and `api-endpoints/profile-api.md`.

### `Experience` and `Education` - two entities on one shared period

Both are timelines: a localized name or two, a code beside it, three date fields, and no
`order`. They are nonetheless **two collections, not one entity with a `kind`**.

The expertise split put three things together because they shared their shape *exactly*.
These do not: a position has an employment type and a role, a course of study has a level
and a qualification, and the fields that differ are the ones every screen renders. One
collection would mean two nullable halves and a `kind` deciding which half is meaningful -
the shape that split existed to remove.

What they really share is the **period**, and that is shared: `yearMonth` and
`checkPeriod` live in `shared` and both compose on them, so the rule relating `startDate`,
`endDate` and `current` is written once and enforced identically on both sides of the wire
for both entities.

Neither has an `order` field or a reorder endpoint. The dates are the order, and a stored
position that disagreed with them would be a state the admin could not see. Both sort
`startDate` descending with `createdAt` as the tie-break, so something still current stays
above something that ended in the month it started.

Mongoose pluralises the collections as `experiences` and `educations`.

### `Option` entity - nine dropdown lists in one collection

The lists behind every select in the admin: availability statuses, the three kinds of expertise category, employment types, education levels, language levels, social platforms and the headings the platform picker groups under. **122 codes across nine lists**, until this pass frozen arrays in `shared` paired with a message key per code in both locales.

One collection for nine lists, for the reason `Expertise` holds three kinds: they are the same shape exactly - a code, a localized label, a position, a unique code, a reorder, and a delete refused while anything still points at it.

| Field | Notes |
|---|---|
| `list` | Which dropdown. An enum - the one part of a list that stays in code |
| `code` | What stored rows hold. **Never rewritten** |
| `name` | Localized, default locale required |
| `group` | The heading it sits under, as a code. Only on `social-platform` |
| `icon` | A vendored brand slug. Only on `social-platform` |
| `order` | Display position within its list |

**Rows reference an option by its code, not by its identifier.** That is what let every row already stored stay valid the day the lists were seeded, with no data migration at all, and what keeps every other API response the shape it already was. The price is that a code is fixed at creation: renaming one would strand every row holding it. The *name* is editable in every locale, and renaming an option relabels every row that holds it.

Two unique indexes, both scoped to the list: `{ list, code }`, because a code is what a row points at, and `{ list, name.<default> }`, because two options spelled alike are indistinguishable in the dropdown they appear in. Scoped, because the lists are independent - `other` is a category, an education level *and* a platform.

The membership check that replaced eight `z.enum`s lives in the services, not in the schemas: whether `frontend` is a category a *tool* may hold is a question about rows, and only a service can see both the kind and the lists at once. See `docs/api-endpoints/options-api.md`.

### `Language` entity - a code with no name

Stores a BCP-47 primary subtag and a CEFR level, and **no name at all**.

`Intl.DisplayNames` knows every subtag's name in the reader's own locale, so a stored name
would be one more thing to translate per language per locale - and a stored English "German"
would be wrong on a French page. The client renders it; the database keeps the code.

Unique on `code`: a language is listed once or not at all. It carries an `order` - the only
one of the four newest entities to do so - because a language list has no date to sort by,
and alphabetical order would put Arabic before English for reasons nobody intends. The
ordering goes through the same shared `applyOrder` the expertise and social-link lists use.

Mongoose pluralises the collection as `languages`.

### `Credential` entity - two kinds, one collection

Certifications and courses share a collection and are told apart by a required `kind`,
where Experience and Education are two entities. The rule that decides is **where the
shapes differ**: a position and a course of study differ in the fields every screen
renders, and a certification and a course do not differ at all - both are *issued by
somebody, on a date, with a name, optionally verifiable at a URL*.

A credential is a **point in time, not a period**, which is why it does not reuse
`checkPeriod`:

- there is no `current`;
- an absent `expiresAt` means "does not expire", where an absent `endDate` means "still
  under way";
- **an expiry in the past is stored, not refused.** An expired certification is a true fact
  about someone's history. The admin marks it; the schema does not judge it.

The only rule relating the two dates is that an expiry cannot precede the issue
(`checkValidity`, in `shared`).

Uniqueness is `{ kind, name.en, issuer.en, issuedAt }` - per kind, so a course and a
certification may share a name, and the same credential may be earned again later. The read
index is `{ kind, issuedAt }`, which is exactly how every list queries it. Mongoose
pluralises the collection as `credentials`.

### `Expertise` entity - three kinds, one collection

Skills, technologies and tools are three different claims and one shape, so they share a
collection and a required `kind` tells them apart.

| Kind | What it is | Examples |
|---|---|---|
| `skill` | A capability or a methodology | System Architecture, Problem Solving |
| `technology` | A language, framework or store | TypeScript, React, PostgreSQL |
| `tool` | Software you operate | Git, Docker, Figma |

One collection because the three share their shape exactly - a localized name, a
category, a level, a position, a unique name, a reorder, an orphan sweep. Three
collections would be three copies of all of that and three chances for one to drift.

The separation is real where it is enforced:

- **Categories are per kind.** A technology is never `collaboration`; a skill is never
  `frontend`. The database enum is the union of all three - a path enum has no view of
  its own document under `findOneAndUpdate` - so it catches a value no kind knows, and
  the kind-specific rule lives in the validation both sides of the wire share.

  Some codes do appear under more than one kind - Security is a capability, a field of
  technology and a class of tool - and those overlaps are **declared**
  (`SHARED_EXPERTISE_CATEGORIES`) rather than merely allowed. An undeclared one fails a
  test, because that is a category that has drifted onto a kind nobody meant it for.

  **Codes are only ever added.** A code that has shipped is a contract with every row
  holding it: removing one strands them on a value nothing will validate again, and the
  row is only found when someone opens the page it is on. `tool.devops` is kept for that
  reason now that `ci-cd`, `containers` and `infrastructure` name the specific cases.
- **Only technologies and tools carry a logo.** There is no brand mark for "Problem
  Solving", so `icon` is absent from the skill shape and refused by name.
- **Uniqueness and ordering are per kind**, through `{ kind: 1, 'name.en': 1 }` unique and
  `{ kind: 1, order: 1 }`. A tool called `Testing` and a skill called `Testing` are two
  different claims.

A project's `stack` references technologies and tools only - never skills, which the
service checks rather than trusting the admin's picker.

The one-off migration that brought an older database across has been deleted: its source
collection no longer exists.

### `Experience` entity - the first timeline

A position held at an organisation: a role, an employer, an employment type, and the
months it ran. It is the entity behind "professional experience" in `PROJECT-OVERVIEW.md`.

**Months are stored as `YYYY-MM` strings, not dates.** A CV says "March 2021", and a
`Date` would claim a precision the data does not have as well as dragging in a timezone
bug - UTC midnight on the first, rendered at a negative offset, is the previous month.
These strings sort chronologically because they sort lexicographically, and compare
directly for the end-after-start rule. Anything rendering one must format in UTC.

**There is no `order` field.** Every other list carries a position the admin moves by
hand; a career is ordered by when things happened, and a stored position that disagreed
with the dates would be a state nobody could see. Sorted `startDate` descending with
`createdAt` as the tie-break - not a second date field, because a current position has no
`endDate` and a missing value sorts as null, which would put the role someone still holds
below the one they left.

**`current` is a state, not an absent end date.** An absent `endDate` could mean "still
there" or "not filled in". `current` says which, and the shared validation ties the two
together: current means no end date, and not current means one is required.

The unique index is compound - role, organisation and start month - because none of the
three is unique alone: one role at two employers, two roles at one employer and two
stints at the same employer are all legitimate.

### `User` entity - confirmed scope

- The project currently uses a **single Admin account** to manage the portfolio.
- There are **no visitor accounts** and **no multi-role system** for now - no public registration feature.
- The `User` entity must still exist in the data model (not hardcoded as a singleton), so the project can evolve later to multiple users/roles **without an architecture rewrite**.
- See `SECURITY.md` for the authentication mechanism.

## Multilingual Content

From the beginning, structure content fields by language in the same document (never duplicate documents by language), even if only `en` is actually populated at launch.

```json
{ "title": { "en": "..." }, "description": { "en": "..." } }
```

Adding a language later only consists of populating these same objects with additional language keys - no schema change. `fr` and `ar` both arrived that way, and the rows written before either existed stayed valid, because only the default locale is ever required.

## Images

Images are **never stored in the database**. A document holds a reference - either one of this application's own upload paths (`/uploads/<category>/<name>.<ext>`) or an absolute `http(s)` URL - and the bytes live on the uploads volume.

Each image that appears on the site sits beside its own **localized `alt`**, keyed by locale like every other piece of prose. It is optional: an empty alt is the correct answer for a decorative image, and a required one only teaches people to type "image".

| Entity | Fields |
|---|---|
| `Profile` | `photoUrl` + `photoAlt` (the one photograph) |
| `Project` | `imageUrl` + `imageAlt` (cover), `gallery: [{ url, alt }]` |

A project also carries four optional localized fields - `role`, `problem`, `approach`,
`outcome` - that say **why it was hard** rather than what it is. Optional by design: a project
with only a description still renders, and forcing a paragraph out of a weekend build produces
filler. `docs/api-endpoints/projects-api.md` records why they are four narrow fields rather
than one rich-text body.
| `Expertise` | `icon: { kind: 'preset' \| 'upload', value }` |
| `Profile` | `resume: { <locale>: <stored path> }` |

A project's gallery is capped, and **position in the array is the display order** - there is no `order` field on an entry. `PUT` sends the whole gallery, so reordering is sending the same entries in a different sequence, and an ordering can never disagree with itself the way a list of positions can.

An expertise row's `icon` is a discriminated union rather than two nullable fields, so "preset and upload both set" is not a state the document can be in. A **preset holds a slug** (`react`, `laravel`) naming a brand mark vendored in the shared package - never markup. See `SECURITY.md` for why that distinction is the whole point.

### Files and the documents that reference them

The profile's `resume` is a locale-keyed map of stored paths rather than a single field: a
CV really differs by language, unlike a photograph, and the project requires adding a
language to be content and configuration rather than a schema change. It has its own
storage category and its own sweep, because a sweep reconciles a category - reading the
wrong field for the wrong directory is precisely how the gallery was nearly deleted.

Which fields hold file references is declared once per feature (`profile.images.ts`, `project.images.ts`; the expertise sweep reads `icon` across all three kinds, since they share one storage category), because two separate places must agree on it: saving deletes the file a field has stopped pointing at, and `uploads:prune` deletes files no document points at. A field missing from the first leaks a file; **a field missing from the second deletes an image that is still in use.**

A *category* missing from `prune-uploads.ts` is the third failure, and the quietest: no
sweep reads that directory, so its files are unreachable and nothing ever mentions them
again. `skill` left the category list when skills, technologies and tools were separated
and its two logos sat there for a month. The reconciliation table is now
`Record<StorageCategory, …>`, so a category with no sweep does not compile, and the script
warns about any directory no category owns.

## The default locale

**This is the canonical statement of the rule; the other documents point here.**

Localized text is a `Map` keyed by locale, and **one locale is required**: `DEFAULT_LOCALE` in `shared`, which is `en`. That is not a preference: the whole content model depends on it:

- every compound unique index on content is keyed on it, because a `Map` has no other stable key to constrain;
- every conflict is reported at the same path, so a client can attach the error to the input the reader typed in;
- every other locale falls back to it, which is what lets a language be added without translating anything first.

Changing it costs an index migration (`npm run db:indexes`) and a data migration for every row whose text does not yet carry the new locale.

## Indexes

Add only according to real query patterns; avoid unnecessary indexes.

`Expertise` carries `{ kind: 1, 'name.en': 1 }` unique and `{ kind: 1, order: 1 }`: every
read of that collection filters by kind and sorts, so the compound index is the query
pattern rather than an anticipation of one. `Experience` carries `{ startDate: -1 }` for
the same reason - every read of it sorts that way and there is no other query. `Option`
carries the same arrangement one level over: `{ list, code }` and `{ list, 'name.en' }`
unique, and `{ list, order }` for the read.

## Seeding

`npm run db:options` fills in the option lists and nothing else. Separate from `db:seed`, which also writes example content: the lists are infrastructure every install needs, and demonstration profiles and projects are not. It is the only seeder that never overwrites - every write is `$setOnInsert` - so it is safe on a database that already holds real content, and it is how a list added after the first install arrives.

`npm run db:seed` fills a development database with realistic content - a profile with both images, skills, technologies and tools with their logos, a career, projects with covers and galleries, social links and an inbox. `-- --reset` clears the seeded collections first, deliberately leaving admin users alone. It refuses to run against a production database.

It is idempotent: every document upserts on the unique key its collection already indexes, and generated images are written under names derived from their subject rather than the storage layer's UUIDs, so a second run overwrites the first instead of leaving orphans. Placeholder images are generated locally, so seeding needs no network.

## Backups

`npm run backup` takes a copy of **both** volumes into `backups/<timestamp>/` - a `mongodump` archive of the database and a tar of the uploaded files - with a manifest recording a document count per collection and the number of files. `npm run restore -- <dir>` puts one back, and then re-counts everything and compares it against that manifest, exiting non-zero on any mismatch.

Two volumes, not one: a database backup does not include the images, and a restored database pointing at files that no longer exist is worse than no backup because it looks complete.

Scheduling, rotation and off-site storage are deployment concerns - see `PRODUCTION-DEPLOYMENT.md`. What exists today is the tool, so the development database has stopped being the only copy.
