# Mail API

What the mail transport is, and whether it works. Infrastructure rather than content: it
reports on the deployment, not on anything the database holds.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## Why the settings are not editable here

The dashboard shows the SMTP settings but cannot change them. **The credentials stay in the
environment**, and this API only reads.

An SMTP password kept in the database is a credential that can be **read back**: it lands in
every backup, any read flaw in the admin API exposes it, and a compromised admin session
leaks a credential that sends mail *as the owner* - worth more to an attacker than the
portfolio itself. What that would buy is editing one file perhaps twice a year, on a machine
that already needs a shell for `admin:password`, `db:seed`, `backup` and `restore`.

The want underneath the request is not file-editing. It is **"does mail reach me?"** - which
is what these two endpoints answer, and which no amount of configuration can settle on its
own, because credentials are only ever wrong at the moment they are used.

If dashboard-managed settings are ever really wanted, the correct build is encrypted at
rest with a key held in the environment. That is a deliberate piece of work, not a convenience
bolted onto this one.

## `GET /api/mail/status`

**Protected.** Requires the admin session cookie.

```json
{
  "code": "SUCCESS",
  "details": {
    "mail": {
      "configured": true,
      "host": "smtp.example.test",
      "port": 587,
      "from": "site@example.test",
      "notifyTo": "owner@example.test"
    }
  }
}
```

With nothing configured, `details.mail` is `{ "configured": false }` and nothing else.

**`SMTP_USER` and `SMTP_PASSWORD` are never returned.** The password is obvious; the user is
here too because it is half a credential and knowing it helps nobody who is allowed to look.
Everything that *is* returned is something the owner configured and can already read in their
own `.env`.

Protected even so: the host and port of a mail server are a hint about the stack, and there is
no reader for them who is not signed in.

| Code | HTTP | When |
| --- | --- | --- |
| `SUCCESS` | 200 | Always, configured or not |
| `UNAUTHENTICATED` | 401 | No valid session |

## `POST /api/mail/test`

**Protected**, and rate-limited to five sends per fifteen minutes. Sends a fixed message to
`CONTACT_NOTIFY_TO`.

The message is entirely ours - no caller supplies any part of it, so there is nothing to
validate and nothing anyone can put into an envelope.

### Success

```json
{ "code": "SUCCESS", "details": { "sentTo": "owner@example.test" } }
```

The recipient is named rather than assumed: "sent" is not useful on its own, because the whole
question is whether it reaches an inbox the owner actually reads.

### Errors

| Code | HTTP | `details` | When |
| --- | --- | --- | --- |
| `UNAUTHENTICATED` | 401 | | No valid session |
| `SERVICE_UNAVAILABLE` | 503 | `{ "mail": "NOT_CONFIGURED" }` | No transport to send with |
| `SERVICE_UNAVAILABLE` | 503 | `{ "mail": "SEND_FAILED" }` | The server refused it |
| `TOO_MANY_REQUESTS` | 429 | | Five sends in fifteen minutes |

### Why a refused send is an error

`sendMail` answers `false` and logs rather than throwing, which is right for a contact form
that must not fail because mail did. **Here the send _is_ the request**, so a refusal is an
error rather than a success carrying a quiet flag - the endpoint exists precisely so that a
failure reads as one.

`SERVICE_UNAVAILABLE` for both cases, distinguished in `details`, because the instance is up
and the answer may differ once someone fixes the settings. The two are worth telling apart:
the fix for one is filling in `.env`, and for the other it is finding out why the server said
no.

### Why it is rate-limited behind a guard

Not against the owner. Against a stuck page, a double click or a retry loop, at a provider
that counts messages and will happily conclude this host is a spam source. The limiter sits
**after** `requireAuth`, for the reason the password limiter gives: ahead of it, an
unauthenticated flood would spend a budget the owner needs.
