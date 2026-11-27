# Social Links API

Read and manage the links to the owner's profiles elsewhere.

All responses follow the centralized API format.

## The link

```json
{
  "id": "507f1f77bcf86cd799439044",
  "platform": "github",
  "url": "https://github.com/me",
  "order": 0,
  "updatedAt": "2026-09-02T10:00:00.000Z"
}
```

| Field | Notes |
|---|---|
| `platform` | One of `github`, `gitlab`, `bitbucket`, `codeberg`, `stackoverflow`, `devto`, `hashnode`, `medium`, `substack`, `npm`, `dockerhub`, `huggingface`, `kaggle`, `leetcode`, `linkedin`, `x`, `mastodon`, `bluesky`, `threads`, `facebook`, `instagram`, `tiktok`, `youtube`, `twitch`, `discord`, `telegram`, `reddit`, `dribbble`, `behance`, `producthunt`, `website`, `other`. **A code, never a label** - the frontend owns the wording and the icon |
| `url` | `http(s)` only. The rule that rejects `javascript:`, `data:` and `file:`, and an upload path too - a social link is never one of our own files |
| `order` | Display position, lowest first. Optional on write, defaults to `0`. Settable only through this API - there is no reorder UI |

**Uniqueness is on the URL, not the platform.** The same link twice is a mistake; two
accounts on one platform is a choice someone might legitimately make.

**Ordering.** `order` ascending, then `platform`.

---

## GET `/api/social-links`

Returns every link, in display order. **Public** - the portfolio's own pages show them.
An empty list is `200`, not `NOT_FOUND`.

## POST `/api/social-links`

Creates a link. **Protected.**

| Code | HTTP | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `VALIDATION_ERROR` | 422 | `{ "url": "INVALID_URL" }`, `{ "platform": "REQUIRED" }` or `{ "platform": "INVALID_VALUE" }` |
| `CONFLICT` | 409 | `{ "url": "URL_TAKEN" }` - its own code, because "that name is already taken" under a field labelled **Link** contradicts the label above it |

## PUT `/api/social-links/:id`

Replaces a link. **Protected.** `NOT_FOUND` covers both an unknown id and an id that is
not an identifier at all.

## DELETE `/api/social-links/:id`

Deletes a link. **Protected.**

---

## Validation codes

| Field | Code | Meaning |
|---|---|---|
| `platform` | `REQUIRED` | Not sent |
| `platform` | `INVALID_VALUE` | Sent, but not one of the nine |
| `url` | `REQUIRED` | Not sent |
| `url` | `INVALID_URL` | Not an `http(s)` URL |
| `order` | `TOO_SMALL` / `INVALID_INTEGER` | Negative, or a fraction |

---

## PUT `/api/social-links/reorder`

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

## Why so many platforms

A developer is found in more places than a general audience is: the code hosts, the
question sites, the writing platforms and the package and model registries all matter here
more than another photo network. The admin's picker renders them in named groups rather
than as one run of thirty, which is the difference between a list you scan and one you
read.

`dockerhub` and `devto` are the codes rather than `docker` and `dev`, because a code names
the _platform being linked to_: Docker is also a tool this portfolio can list, and the two
are not the same claim.

As everywhere else, codes are only added. One that has shipped is a contract with the rows
holding it.
