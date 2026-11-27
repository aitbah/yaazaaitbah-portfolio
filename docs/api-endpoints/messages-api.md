# Messages API

The contact form's submissions, and the admin inbox that reads them.

All responses follow the centralized API format.

## The message

```json
{
  "id": "507f1f77bcf86cd799439033",
  "name": "Someone",
  "email": "someone@example.com",
  "subject": "Hello",
  "body": "I would like to talk.",
  "read": false,
  "receivedAt": "2026-09-02T10:00:00.000Z"
}
```

Not localized: a message is what one person wrote, in whatever language they wrote it.

**Nothing here is ever edited.** The only mutable field is `read`, which is the owner's
bookkeeping rather than part of what was sent - editing the rest would make the record a
lie, which is why there is no `PUT`.

---

## POST `/api/messages`

**The only public write in the application**, and the reason `SECURITY.md` has a section
about the contact form.

### Request

```json
{
  "name": "Someone",
  "email": "someone@example.com",
  "subject": "Hello",
  "body": "I would like to talk.",
  "website": ""
}
```

`website` is the **honeypot** - a hidden field a real browser never fills.

### Success

**HTTP 200**, with **empty** `details`.

Deliberately nothing about what was stored: the sender does not need an id, and echoing
the stored values back would turn the endpoint into a way to probe what validation
accepts.

**200 means stored, not emailed.** The owner's notification is started after the write and
is not waited for, so the sender never pays for a round trip to the mail server - it was
about 2.7 s against a real SMTP host. A notification that fails is logged; one still in
flight when the process stops is lost. The message itself is not: it is in the database
before any mail is attempted, and the inbox is where it is read.

### Protection

| Measure | Detail |
|---|---|
| Honeypot | A filled `website` is **accepted and discarded**. The response is byte-for-byte the one a real sender gets |
| Burst limit | 2 accepted per minute per address |
| Hourly limit | 5 accepted per hour per address |
| Validation | Strict, per field, before anything is stored |
| Sanitization | Control, bidirectional and zero-width characters removed |
| CAPTCHA | **None** for now - added only if real spam appears |

**Why the honeypot is not a validation error.** Refusing it would answer `422` naming the
field, telling whatever sent it exactly what gave it away - and the next attempt would
leave that field alone. The trap only works if springing it is invisible. The shared rule
therefore does not constrain `website` beyond a length cap; the *service* discards.

**Why two rate limits.** They answer different abuses: the burst limit stops a script
submitting as fast as it can, the hourly limit stops a slower, more patient one. A single
window cannot do both - set it low enough to stop the burst and a real person sending a
second message an hour later is refused too.

Only accepted submissions count: a `422` or a `429` does not use up a visitor's
allowance, so someone correcting a typo is not locked out. A honeypot hit answers `200`
and so still counts against whatever sent it.

Both are per-address and in memory, so a restart of the backend resets them.
`PRODUCTION-DEPLOYMENT.md` records that a shared store is needed once there is more than
one process.

### Errors

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 422 | See the field codes below |
| `TOO_MANY_REQUESTS` | 429 | Past either limit |

A rejected submission never explains why it looked like spam.

---

## GET `/api/messages`

Returns one page of messages, **newest first**, with the unread count. **Protected** - an
inbox is not public.

`?page=` selects the page, counting from `0`. It comes from a URL, so anything unusable -
a word, a negative number, a fraction, nothing at all - opens the first page rather than
refusing to open the inbox.

```json
{
  "code": "SUCCESS",
  "details": {
    "messages": [],
    "unread": 0,
    "page": 0,
    "pageSize": 20,
    "total": 0
  }
}
```

`total` counts every message, not the page - it is what a pager counts through. A page past
the end is an empty page, not an error: that is what a stale link produces once messages
have been deleted.

The admin reads the inbox with the same "show more" control as every other list: each further page is fetched and **appended** under the ones already on screen rather than replacing them, and a message that arrives between two loads - shifting the offsets by one - is shown once, not twice.

**This is the only list in the application that pages**, because it is the only one a
stranger can add rows to. Every other list is exactly as long as the owner chose to make
it, and `API-RULES.md` says to impose pagination only where it provides real value.

## PATCH `/api/messages/:id/read`

Marks a message read or unread. **Protected.**

```json
{ "read": true }
```

Sets that flag and **nothing else**, whatever else the request body contains.

## DELETE `/api/messages/:id`

Deletes a message. **Protected.**

---

## Validation codes

| Field | Code | Meaning |
|---|---|---|
| `name`, `subject`, `body` | `REQUIRED` | Missing, or blank once trimmed |
| `name`, `subject`, `body` | `TOO_BIG` | Past 80, 150 and 5000 characters |
| `email` | `REQUIRED` | Not sent |
| `email` | `INVALID_EMAIL` | Not an address |
| `website` | `TOO_BIG` | Past 150 characters - the honeypot cannot also be a large payload |
