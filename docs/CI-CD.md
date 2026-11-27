# CI and CD

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests, in two jobs.

**`verify`**, against a real MongoDB service container:

```bash
npm ci
npm run lint
npm run typecheck
npm run format:check
npm test -w shared
npm test -w backend      # database-backed suites throw instead of skipping when CI=true
npm test -w frontend
npm run build
```

Each gate is its own step, so each exit code is read on its own. Each package's `test`
script already runs with `--coverage`, so the thresholds in its `vitest.config.mts` are
enforced.

**`end-to-end`** (needs `verify`): starts the development stack with Docker Compose, waits
on `/api/health`, fills the database with `npm run db:seed`, and runs the Playwright suite
in Firefox. The report and the container logs are uploaded when it fails.

Run the same gates locally from the repository root, each as its own command, and read
its real exit code rather than piping it through `tail` or `grep`.

## Staging: a release before it is one

`docker-compose.staging.yml` runs the **production build** on its own ports
(`127.0.0.1:3001` and `:5001`), project and volumes, so a change can be seen exactly as it
will ship:

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
docker compose -f docker-compose.staging.yml --env-file .env.staging exec -T backend node dist/seed-options.js
docker compose -f docker-compose.staging.yml --env-file .env.staging exec -T -e NODE_ENV=development backend node dist/seed/seed.js
```

It builds its own frontend image because `NEXT_PUBLIC_API_URL` is baked in at build time;
reusing the production image would point the preview at the live API.

## The compose files are not interchangeable

| | File | Project | Volumes |
|---|---|---|---|
| production | `docker-compose.prod.yml` | `portfolio` | `portfolio_*` |
| staging | `docker-compose.staging.yml` | `portfolio-staging` | `portfolio-staging_*` |
| development | `docker-compose.yml` | `portfolio-dev` | `portfolio-dev_*` |

The project name prefixes the volumes as well as the containers, so the three never touch
each other's data. Always pass `-f` explicitly.

## Deployment

Manual, on the server, with `./scripts/deploy.sh` (see
[`PRODUCTION-DEPLOYMENT.md`](PRODUCTION-DEPLOYMENT.md)). It records the running images,
builds before recreating anything, waits on the healthchecks, syncs the indexes, checks
the live hosts and rolls back on any failure.
