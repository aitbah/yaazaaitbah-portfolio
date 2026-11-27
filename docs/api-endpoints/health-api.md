# Health API

Whether this instance is able to serve. Infrastructure, not content: it reports on the
process and its database connection, and never on anything the database holds.

All responses follow the centralized API format:

```json
{
  "code": "...",
  "details": {}
}
```

## `GET /api/health`

Public. No session, no rate limit - the things that ask are a container health check, a load
balancer, an uptime monitor and the pipeline's readiness gate, none of which has a session,
and a monitor that polls every few seconds must not be throttled into looking unhealthy.

| Outcome | Status | Code |
| --- | --- | --- |
| The database connection is live | `200` | `SUCCESS` |
| The process is up, the connection is not | `503` | `SERVICE_UNAVAILABLE` |

`details` is always empty.

### Why it discloses nothing

No version, no uptime, no database name, no commit. None of the four callers above needs any
of it, and an unauthenticated endpoint that describes its host is useful mainly to whoever is
enumerating the host. The status code carries the whole answer.

### Why 503 and not 500

The instance is running and the answer may differ a second later. `curl -sf`, container
health checks and load balancers all treat 503 as "not yet" and 500 as "broken" - and a
readiness gate that sees "not yet" keeps waiting instead of proceeding.

The connection is checked rather than assumed: `bootstrap` connects before it listens, so any
answer at all proves the connection succeeded *at startup*. This endpoint is about the other
case - a connection dropped hours later, where the process still accepts requests and fails
every one of them.

### Why it must be answerable by an empty database

This endpoint exists because the pipeline's readiness gate used to poll `GET /api/profile`,
which throws `NOT_FOUND` until a profile exists - and the step that writes one runs *after*
the wait. The gate waited for data produced by the step behind it. Every run timed out at
exit 124 while the stack sat there healthy, logging a 404 every three seconds for five
minutes.

A readiness check answers "can this instance serve?", never "has anyone filled it in yet?".
`backend/tests/core/health/health.api.test.ts` pins the difference by asserting both answers
in one test: health is 200 on the same empty database where the profile is a 404.
