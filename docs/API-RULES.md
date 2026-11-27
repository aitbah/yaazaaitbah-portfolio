# API & Backend Rules

## Response Format (mandatory and centralized)

**Success**
```json
{ "code": "SUCCESS", "details": {} }
```

**Validation error**
```json
{ "code": "VALIDATION_ERROR", "details": { "email": "INVALID_EMAIL", "password": "REQUIRED" } }
```

**Main codes**: `SUCCESS`, `VALIDATION_ERROR`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `METHOD_NOT_ALLOWED`, `TOO_MANY_REQUESTS`, `SERVER_ERROR`.

## Rules

- The API returns codes, never translated messages for the end user.
- Controllers/services never create ad hoc error responses - everything goes through the centralized Express global error handler in the kernel/core layer.
- **A request the API cannot read is the client's error, never a `SERVER_ERROR`.** A JSON body that does not parse answers `VALIDATION_ERROR` with `{ "body": "INVALID_VALUE" }`, and one over the 100 KB limit answers `{ "body": "TOO_BIG" }`, before any route runs. A path that cannot be percent-decoded (`/api/projects/%E0`) names nothing, so it answers `NOT_FOUND`.
- **Each endpoint must define**: HTTP method, public/protected status, required validation, response format, permissions (if applicable).
- **Lists**: pagination/filtering/sorting only when they provide real value - do not impose them systematically.
- **Documentation**: every endpoint documented (method, route, auth, request, response, validation, errors, permissions); Markdown is sufficient when appropriate. Postman for manual testing.

Authentication and security rules → see `SECURITY.md`.
