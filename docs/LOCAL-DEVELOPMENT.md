# Local Development

**Status: this is the current, working setup.** It is what `docker-compose.yml` actually runs today.

This document covers local development only. Running the project on a server is described in [`PRODUCTION-DEPLOYMENT.md`](PRODUCTION-DEPLOYMENT.md).

---

## Scope of this setup

The stack is built to run on one developer machine, with hot reload and no barriers. It is **deliberately not hardened**:

- both containers run **development servers**, not builds;
- MongoDB runs **without authentication**;
- ports are published on `127.0.0.1` only, so a browser and local tooling on this machine can reach them and nothing else on the network can.

That is appropriate here and unsafe anywhere else. The reasons and the required changes are in `PRODUCTION-DEPLOYMENT.md`.

---

## Services

| Service | Role | Image / build | Host port | Command |
|---|---|---|---|---|
| `frontend` | Next.js (TypeScript) | `frontend/Dockerfile`, context `.` | `127.0.0.1:3000` (`FRONTEND_BIND`) | `next dev -H 0.0.0.0` |
| `backend` | Node.js + Express (TypeScript) | `backend/Dockerfile`, context `.` | `127.0.0.1:${BACKEND_PORT}` | `npm run dev` (`tsx watch`) |
| `mongo` | MongoDB | `mongo:8` | `127.0.0.1:27017` | default |

Both build contexts are the **repository root**, not the package directory: each package
resolves `@portfolio/shared` through the npm workspace, which lives above it. A root
`.dockerignore` keeps the context to a few kilobytes.

The compose project is `portfolio-dev`, and container names are fixed (`portfolio-dev-frontend`, `portfolio-dev-backend`, `portfolio-dev-mongo`) so `docker compose exec` commands are predictable. The project name also prefixes the volumes and the network, which keeps them apart from the production stack's.

`mongo` has a healthcheck (`db.adminCommand('ping')`); `backend` waits for it with `depends_on: condition: service_healthy`. `frontend` depends on `backend` without a condition, so it may briefly start before the API answers - harmless in development, since the browser retries on reload.

---

## Network

One bridge network, `portfolio-dev_portfolio-network`. Inside it, services resolve each other **by service name**:

```text
mongodb://mongo:27017/...     ← backend to database
```

`localhost` inside a container means that container, never the host. The single exception is `NEXT_PUBLIC_API_URL`: the frontend calls the API from the **browser**, so that value must resolve from the host (`http://localhost:5000`), not from the Docker network.

The frontend *server* needs the opposite answer, which is why it has its own variable. `INTERNAL_API_URL` is set by compose to `http://backend:<port>` and is what the image optimizer uses to fetch an upload - from inside the frontend container, where `localhost` is the frontend.

---

## Volumes

The workspace puts each package one level down, so the container paths mirror the
repository: `/app` is the workspace root, `/app/backend` and `/app/frontend` are the
packages, and each service's working directory is its own package.

| Volume | Mounted at | Purpose |
|---|---|---|
| `mongo-data` | `/data/db` (mongo) | Database files - survive `docker compose down` |
| `uploads-data` | `/app/backend/uploads` (backend) | Uploaded images - survive container recreation |
| `./backend` → `/app/backend` | bind mount | Source, for hot reload |
| `./frontend` → `/app/frontend` | bind mount | Source, for hot reload |
| `./shared` → `/app/shared` | bind mount | Source **and** its compiled `dist/` - see below |
| `./private` → `/app/private` | bind mount, **read-only** (backend) | The owner's personal content, Git-ignored apart from `.gitkeep` - which is there so the folder exists, owned by you, before Docker mounts it; otherwise Docker creates it as root. `db:seed` takes the profile photograph from it - see *Getting started* |
| *anonymous* | `/app/node_modules` (both) | Keeps the image's dependencies instead of the host's |
| *anonymous* | `/app/<package>/node_modules` (both) | Same, for anything npm did not hoist |
| *anonymous* | `/app/frontend/.next` (frontend) | Keeps the build cache out of the host tree |

The anonymous `node_modules` volumes matter more than they used to. npm hoists almost
everything to `/app/node_modules`, and the host's copy holds **glibc** native binaries
(`@node-rs/argon2-linux-x64-gnu`) while these Alpine images need **musl** ones. Without
those volumes the host's tree would shadow the image's and the backend would not start.

Three consequences:

**New npm dependencies need a rebuild.** The anonymous `node_modules` volume shadows the host directory, so installing a package locally is not enough:

```bash
docker compose up -d --build --renew-anon-volumes <service>
```

**`shared/` is consumed as compiled JavaScript.** Both packages import
`@portfolio/shared` from its `dist/`, which is built by the `prepare` script during
`npm install` and bind-mounted from the host. After editing anything in `shared/src`,
rebuild it so the containers see the change:

```bash
npm run build -w shared
```

**`uploads-data` shadows `./backend/uploads`.** Because `./backend` is bind-mounted at `/app/backend`, anything written to `/app/backend/uploads` *before* the named volume existed landed in the host directory instead. That directory is now stale and gitignored; the live files are in the volume. Any future change to this mount has the same hazard - files do not move themselves.

---

## Environment variables

Real values live in `.env` (never committed). `.env.example` lists the names only.

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | yes | Points at the `mongo` service, not `localhost` |
| `BACKEND_PORT` | yes | Also used for the host port mapping |
| `FRONTEND_URL` | yes | The CORS allow-list origin |
| `JWT_SECRET` | yes | Minimum 32 characters |
| `NEXT_PUBLIC_API_URL` | yes | Backend URL **as the browser sees it** |
| `INTERNAL_API_URL` | no | Backend URL **as this container sees it**. Set by compose to `http://backend:<port>`; defaults to `http://localhost:5000`, which is right when the frontend runs on the host. It is what `/uploads/*` is proxied to, so the image optimizer can fetch a stored file |
| `NEXT_PUBLIC_SITE_URL` | no | The site's own origin, for canonical URLs, hreflang and the sitemap. Defaults to `http://localhost:3000` |
| `TRUST_PROXY` | no | How many reverse proxies to believe for the client address. Defaults to `0`, which is right with no proxy in front |
| `NODE_ENV` | no | Defaults to `development` |
| `LOG_LEVEL` | no | Defaults to `info` |
| `UPLOADS_DIR` | no | Defaults to `uploads`, relative to the backend working directory (`/app/backend`) |
| `FRONTEND_BIND` | no | The host address the frontend is published on. Defaults to `127.0.0.1`, this machine only; `0.0.0.0` opens it to the home network as well - see *Opening the site from a phone* |
| `DEV_HOSTS` | no | Hosts besides `localhost` and `127.0.0.1` allowed to load the dev server's scripts, comma-separated |

The backend validates its environment with Zod at boot and **exits immediately** if anything is missing or malformed, printing variable names only - never values.

Note that `docker-compose.yml` sets `NODE_ENV: development` explicitly for both services, overriding whatever `.env` says.

---

## Getting started

```bash
cp .env.example .env      # then fill in the values
docker compose up -d
```

| URL | What |
|---|---|
| http://localhost:3000 | Frontend (redirects `/` to `/en`) |
| http://localhost:5000 | Backend API |
| mongodb://localhost:27017 | MongoDB |

Create the first admin account - there is no registration endpoint, and the credentials are passed inline so they never reach `.env` or the shell history file of a running container:

```bash
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='...' \
  backend npm run admin:create
```

Locked out of it? Both credentials can be reset from the shell. This is the recovery path the
admin's own forms point at, because there is no mail transport and shell access to the machine
is a stronger credential than an inbox anyway:

```bash
# A forgotten or mistyped password. The same 12-character policy applies.
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='...' \
  backend npm run admin:password

# An address typed wrongly in the account form, which is what you now sign in with.
docker compose exec -e ADMIN_EMAIL=wrong@example.com -e ADMIN_NEW_EMAIL=you@example.com \
  backend npm run admin:email
```

Both revoke every session, so every device signs in again.

Sample content, for a portfolio that has none yet - it **replaces** every seeded collection:

```bash
docker compose exec backend npm run db:seed
```

The profile photograph is the owner's own when `private/profile-photo.png` exists, and a drawn
placeholder when it does not - a clean checkout and CI get the placeholder. The file is checked the
way an upload is (a PNG, JPEG or WebP by its bytes, 2 MB at most) and its camera metadata is
stripped before it is written; a file that is there but unusable stops the seed rather than being
silently ignored. It is never committed: `private/` is Git-ignored, and a photograph in Git is in
the history for good.

After changing an index - or a field an index names - reconcile the database
with the models. Mongoose adds an index it has never seen and removes none, so
an index that outlives the rule that created it keeps enforcing that rule with
nothing in the repository to say so:

```bash
docker compose exec backend npm run db:indexes
```

Two had accumulated by the time this was written. `educations` carried a unique
index on the institution alone and quietly refused a second qualification from
one university - the model has never declared it, and the test that says a
university may award two degrees passes, because a test database is built from
the schema and the development one was not.

---

## Everyday commands

```bash
docker compose logs -f backend    # follow logs
docker compose restart backend    # restart one service
docker compose down               # stop; both named volumes survive
docker compose down -v            # stop and DELETE the database and uploads
```

### Adding a dependency to a workspace

Installing on the host is **not enough**. The compose file mounts anonymous volumes over
`/app/node_modules` and `/app/backend/node_modules`, so the container keeps the modules its
image was built with - the host's are deliberately not used, since the workspace hoists them
to the root and the host's native binaries are glibc while the image is musl.

```bash
npm install <package> -w backend                     # the host, for tooling and tests
docker compose build backend                         # bake it into the image
docker compose up -d --renew-anon-volumes backend    # and replace the stale volume
```

**Both** of the last two are needed. `--build` alone rebuilds the image and then mounts the
*old* anonymous volume over it, so the container still cannot find the package and the error
looks exactly like a failed install:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'nodemailer' imported from …
```

### Opening the site from a phone

The development site can be opened from a phone on the same Wi-Fi, at this machine's address on the
network - `ip -4 addr` shows it. In `.env`:

```bash
FRONTEND_BIND=0.0.0.0          # publish the frontend on every interface, not only loopback
DEV_HOSTS=192.168.1.20        # this machine's address: allowed to load the dev server's scripts
```

then `docker compose up -d frontend`, and open `http://<that address>:3000` on the phone. `localhost`
keeps working. Without `DEV_HOSTS` the page arrives with no script - Next.js blocks its development
resources for any origin but `localhost`, `127.0.0.1` included until it was added - and the world
behind the words stays black.

While it is set, anyone on the same network can open the development site, the admin's login page
included. The admin itself does not work from the phone: its browser calls go to
`NEXT_PUBLIC_API_URL`, `localhost:5000`, which on the phone is the phone. Clear `FRONTEND_BIND` and
recreate the container to close it again.

### Mail

Optional, and off unless configured - see the block at the bottom of `.env.example`. With it
set, the owner is emailed whenever someone uses the contact form; without it, the form behaves
identically and the backend logs `Mail is not configured; notifications are off` at startup.

To see what would be sent without sending it anywhere, run a catcher and point `.env` at it:

```bash
docker run -d --rm --name mailprobe \
  --network portfolio-dev_portfolio-network -p 127.0.0.1:8025:8025 axllent/mailpit
# SMTP_HOST=mailprobe SMTP_PORT=1025 SMTP_FROM=… CONTACT_NOTIFY_TO=…
```

Everything it receives is at http://localhost:8025, headers included - which is the only way
to check the ones a visitor's text is not allowed to reach.

### Taking a copy, and putting one back

```bash
npm run backup                    # → backups/<timestamp>/
npm run restore -- backups/<timestamp>
```

Run from the repository root, on the **host**: `mongodump` lives in the `mongo` image and
the uploaded files live in the `backend` one, so the only place that can reach both is the
machine running compose. That is the opposite of `db:seed` and `db:options`, which are
application code and run inside the container.

**Both volumes, in one folder.** A database backup does not include the images, and a
restore from a database-only copy brings back a portfolio whose photographs are all missing -
which is worse than no backup, because it looks complete.

`restore` **replaces everything**: the database is dropped and the uploads directory is
emptied before either is written, so the result is the backup rather than a merge of the two.
There is no "latest" and no default - the directory is the argument, and the argument is the
confirmation. Afterwards it re-counts every collection and every file and compares them
against the manifest the backup wrote, exiting non-zero on any mismatch. A restore that
silently brought back nothing is the failure worth guarding against, so every restore checks
itself.

`backups/` is ignored by Git. It is the owner's real content.

### If `next typegen` fails with `EACCES`

`frontend/.next` is a mount point for an anonymous volume, and the frontend container runs as
root - so when Docker has to *create* that directory it creates it owned by root, and nothing
on the host can write inside it afterwards. `npm run lint` and `npm run typecheck` both fail
there, and the failure mentions `EACCES`, never a type error.

The directory only gets created by Docker when it is missing, so the remedy is to own it
first:

```bash
docker compose stop frontend
docker run --rm -v "$PWD/frontend:/f" alpine rm -rf /f/.next
mkdir frontend/.next
docker compose up -d frontend
```

The volume itself is right and stays: without it the container would write its build output
into the bind mount as root, which is worse, and a host `next build` would fight the dev
server for the same directory.

From the repository root, each gate runs across all three packages:

| Command | Purpose |
|---|---|
| `npm test` | Vitest, in `shared`, `backend` and `frontend` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run format:check` | Prettier, check only |
| `npm run build` | Compiles `shared`; production builds of the other two (verification only - no image uses them yet) |

Add `-w <package>` to run one of them on its own - `npm test -w backend`. Coverage is
per package, since the thresholds are: `npm test -w backend -- --coverage`.

Package-specific:

| Command | Where | Purpose |
|---|---|---|
| `npm run dev` | `backend`, `frontend` | Development server |
| `npm run build -w shared` | root | Recompile `shared/dist` after editing it |
| `npm run test:e2e` | `frontend` | Playwright - **needs the stack running** |

Some suites need the stack up rather than mocks:

- `backend` - the persistence, migration and maintenance suites run against the real
  MongoDB, each in a database of its own that it drops afterwards. Without a reachable
  database they **skip loudly** rather than failing, so `npm test` still works on a
  machine with nothing started. Under `CI=true` they **throw instead of skipping**: CI
  provides a database on purpose, and a suite that quietly skipped there would turn the
  guarantee back into a hope.
- `frontend` - the Playwright specs need the frontend, the backend and MongoDB. They run
  against **your development database**, which is why the teardown matters as much as the
  specs do.

  Global setup takes a snapshot of **every collection except `users`** and the teardown
  writes it back, so a run leaves the database byte-identical however it ends. It is
  deliberately not a list of collection names: the list went stale - it named `skills`
  after the expertise split had abandoned that collection, and `experiences` was never
  added - so for months the suite restored a dead collection over itself while the rows it
  created survived every run. That is where the `E2E …` rows in the admin came from.
  Naming no collection is what stops the next entity from repeating it.

  Accounts are the exception, and are handled by prefix: every disposable admin's address
  starts with `e2e-`, generated nowhere else, and both setup and teardown sweep the lot -
  so a run that dies before its teardown no longer leaves an account behind for good.

  **The uploads volume is snapshotted the same way**, and for the same reason one layer
  down: a spec that uploads a gallery image writes a row *and* a file, and restoring the
  row leaves the file behind with nothing pointing at it. Sixty-three had collected that
  way, two per run. The teardown deletes what appeared during the run and nothing else -
  sweeping every unreferenced file instead is `uploads:prune`'s job, and would take
  whatever you had uploaded in another window with it.

  If you ever need to check: the database before and after a full run should compare
  equal, `db.users` should hold only your own admin, and `find uploads -type f` inside the
  backend container should list the same files.

**Run each gate as its own command and read its real exit code.** Piping into `tail` or `grep` replaces the exit status with the pipe's, which once reported a passing lint while ESLint was failing.

---

## Files

```text
portfolio/
├── shared/                 # @portfolio/shared - compiled to dist/, no image of its own
├── frontend/
│   └── Dockerfile          # development image, built from the repository root
├── backend/
│   └── Dockerfile          # development image, built from the repository root
├── package.json            # workspace root
├── package-lock.json       # one lockfile for all three packages
├── .npmrc                  # npm fetch retries, so a slow link cannot fail a build
├── .dockerignore           # the context is the whole repository now
├── docker-compose.yml
├── .env                    # real values, never committed
└── .env.example            # names only
```

Each service owns its `Dockerfile`; `docker-compose.yml` at the root orchestrates the three services, the network and the two named volumes.

---

## Known limitations of this setup

These are accepted for local development and are **not** defects to fix here:

- No reverse proxy, no TLS - plain HTTP on localhost.
- MongoDB is unauthenticated, and published on the loopback interface only.
- Development servers, so no production build is ever exercised except by `npm run build`.
- Only `mongo` has a healthcheck.

Each of these is addressed in [`PRODUCTION-DEPLOYMENT.md`](PRODUCTION-DEPLOYMENT.md).
