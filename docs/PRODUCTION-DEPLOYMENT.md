# Production Deployment

How the production stack is built and run on a single VPS. Local development is
[`LOCAL-DEVELOPMENT.md`](LOCAL-DEVELOPMENT.md); **never deploy the development stack**
(see the table at the end for why).

## The stack

`docker-compose.prod.yml` runs three services, none of them on the public interface:

| Service | Image | Notes |
|---|---|---|
| `mongo` | `mongo:8` | Root credentials set; no published port. A least-privilege application user is created on first boot by `scripts/mongo-init-user.js` |
| `backend` | `backend/Dockerfile.prod` | Multi-stage, `NODE_ENV=production`, runs `node dist/server.js` as a non-root user, published on `127.0.0.1` only |
| `frontend` | `frontend/Dockerfile.prod` | Next.js `output: 'standalone'`, no source in the runtime image, non-root, published on `127.0.0.1` only |

All three have healthchecks, restart policies, memory limits and log rotation
(`json-file`, 10 MB × 5).

```bash
cp .env.production.example .env.production   # then fill it in
./scripts/deploy.sh
```

**Always pass `-f docker-compose.prod.yml --env-file .env.production`** to any manual
compose command: a bare `docker compose` picks the development file.

## Deploying, and rolling back

`scripts/deploy.sh` is the whole procedure:

1. records the images currently running as a rollback point;
2. builds the new images **before** recreating anything, so a broken build costs no downtime;
3. starts the stack and waits for every healthcheck;
4. synchronises the database indexes (`dist/sync-indexes.js`);
5. checks the live hosts answer;
6. puts the previous images back if any step fails.

`./scripts/deploy.sh --rollback` restores the recorded images by hand.

## The edge: TLS and the two hosts

Something has to terminate TLS on 80/443. Two matching Caddyfiles cover both shapes:

- **This stack is the whole server:** start the bundled `proxy` service
  (`--profile bundled-proxy`), configured by `scripts/Caddyfile`. It obtains and renews
  certificates and serves `/uploads` straight from the volume.
- **The machine already runs Caddy:** install `scripts/Caddyfile.host` as an import of the
  host's Caddyfile; it reaches the containers on their loopback ports.

  ```bash
  sudo install -m 644 scripts/Caddyfile.host /etc/caddy/Caddyfile.d/portfolio.caddy
  grep -q Caddyfile.d /etc/caddy/Caddyfile || \
    echo 'import /etc/caddy/Caddyfile.d/*.caddy' | sudo tee -a /etc/caddy/Caddyfile
  sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
  ```

Either way the result is the site on `SITE_DOMAIN`, the admin on `ADMIN_DOMAIN`, and
`www.` redirecting to the apex. Behind Cloudflare, `Caddyfile.host` trusts
`CF-Connecting-IP` only from Cloudflare's published ranges.

### Why the admin has a host of its own

Both hosts serve the same build. The session cookie is issued for the host the browser
is on, so it exists on the admin's host and never on the public one. This works because
the browser bundle addresses the API **by path** (`NEXT_PUBLIC_API_URL=same-origin`):
one build is right under both names, the cookie stays first-party, and CORS never enters
into it.

## Operating the stack

The production image carries compiled JavaScript only (no `tsx`), so run the compiled
files:

```bash
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

# The first admin account (there is no registration endpoint)
$COMPOSE exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='…' \
  backend node dist/features/auth/create-admin.js

# The option lists behind every dropdown, which a fresh database has none of
$COMPOSE exec backend node dist/seed-options.js

# Index reconciliation (deploy.sh already runs it)
$COMPOSE exec backend node dist/sync-indexes.js
```

Public pages render per request from the live API, whose reads are cached for five
minutes, so an edit made in the admin shows within that window and no warm-up is needed
after a deploy.

## Variables baked in at build time

Three variables are read during `next build` and frozen into the frontend image. They are
build arguments in `frontend/Dockerfile.prod`; setting them only at runtime leaves the
wrong value compiled in:

| Variable | What goes wrong when it is only set at runtime |
|---|---|
| `NEXT_PUBLIC_API_URL` | The browser calls a development address |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs and social cards point at the wrong host |
| `INTERNAL_API_URL` | Every uploaded image 404s and the CV never downloads: the `/uploads` rewrite is resolved at build |

## Why the development stack must not be deployed

| Development | Production |
|---|---|
| MongoDB without authentication, port published | Root credentials, least-privilege app user, no published port |
| `tsx watch` and `next dev` | Compiled builds, `NODE_ENV=production`, non-root |
| `trust proxy` unset | `TRUST_PROXY` set to the number of proxies (one), never `true` |
| No HSTS, CSP only tested on a dev server | HSTS in production; the admin CSP verified against a production build |

## Worth adding

Backups on a schedule and off the machine (`npm run backup` / `npm run restore` exist and
verify themselves), request logging with correlation IDs, uptime monitoring, and closing
the origin to everything but the CDN when one is in front.
