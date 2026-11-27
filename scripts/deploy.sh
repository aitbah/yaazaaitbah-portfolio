#!/usr/bin/env bash
#
# Deploys the production stack, and puts the old one back if the new one does
# not come up healthy.
#
#   scripts/deploy.sh              # build, deploy, verify
#   scripts/deploy.sh --no-build   # redeploy the images already built
#   scripts/deploy.sh --rollback   # restore the last recorded good images
#
# The manual path and whatever automates it run this same script, so the two
# cannot drift. Every step is the one `docs/PRODUCTION-DEPLOYMENT.md` documents.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.production)
SERVICES=(backend frontend)
STATE="$REPO/.deploy-rollback"

# The public names, for the check at the end. The stack answers on loopback and
# the host's Caddy fronts it, so we resolve the names there rather than over DNS.
SITE_DOMAIN="$(grep -E '^SITE_DOMAIN=' .env.production 2>/dev/null | cut -d= -f2-)"
ADMIN_DOMAIN="$(grep -E '^ADMIN_DOMAIN=' .env.production 2>/dev/null | cut -d= -f2-)"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '    \033[31m✗\033[0m %s\n' "$*"; }
die()  { bad "$*"; exit 1; }

[ -f .env.production ] || die ".env.production is missing; this is not a production host."

# ── the rollback point ───────────────────────────────────────────────────────
# The image each service is *running right now*, by id. Tagged so a later
# `docker image prune` cannot take the only copy of a working build away.
record_rollback() {
  say "Recording a rollback point"
  : > "$STATE"
  for s in "${SERVICES[@]}"; do
    cid="$("${COMPOSE[@]}" ps -q "$s" 2>/dev/null)"
    if [ -z "$cid" ]; then
      bad "$s is not running; nothing to roll back to"
      continue
    fi
    img="$(docker inspect -f '{{.Image}}' "$cid")"
    docker tag "$img" "portfolio-$s:rollback" 2>/dev/null \
      && echo "$s $img" >> "$STATE" \
      && ok "$s → portfolio-$s:rollback ($(echo "$img" | cut -c8-19))"
  done
}

restore_rollback() {
  say "Rolling back"
  [ -s "$STATE" ] || die "no rollback point recorded ($STATE is empty)"
  while read -r s img; do
    [ -z "${s:-}" ] && continue
    docker tag "$img" "portfolio-$s:latest" && ok "$s ← $(echo "$img" | cut -c8-19)"
  done < "$STATE"
  "${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 180 \
    && ok "previous stack is back up" \
    || die "rollback failed to come up - investigate by hand, do not retry blindly"
}

# ── verification ─────────────────────────────────────────────────────────────
health_ok() {
  local unhealthy
  unhealthy="$("${COMPOSE[@]}" ps --format '{{.Name}} {{.Status}}' 2>/dev/null \
    | grep -v '(healthy)' | grep -v '^$' || true)"
  [ -z "$unhealthy" ] || { bad "not healthy:"; echo "$unhealthy" | sed 's/^/        /'; return 1; }
  return 0
}

http_ok() {  # host, path, expected
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --resolve "$1:443:127.0.0.1" \
          "https://$1$2" --max-time 25 2>/dev/null)"
  [ "$code" = "$3" ] && { ok "$1$2 → $code"; return 0; }
  bad "$1$2 → $code (wanted $3)"; return 1
}

verify_live() {
  say "Verifying the live site"
  local bad=0
  for l in en fr ar; do http_ok "$SITE_DOMAIN" "/$l" 200 || bad=1; done
  http_ok "$SITE_DOMAIN" "/api/health" 200 || bad=1
  http_ok "$SITE_DOMAIN" "/sitemap.xml" 200 || bad=1
  http_ok "$ADMIN_DOMAIN" "/" 301 || bad=1
  return $bad
}

# ── modes ────────────────────────────────────────────────────────────────────
case "${1:-}" in
  --rollback) restore_rollback; verify_live && ok "rolled back and verified"; exit $? ;;
  --no-build) BUILD=0 ;;
  "")         BUILD=1 ;;
  *)          die "unknown option: $1" ;;
esac

record_rollback

if [ "$BUILD" = "1" ]; then
  say "Building"
  # Before anything is recreated, so a broken build costs no downtime at all.
  "${COMPOSE[@]}" build || die "build failed; the running stack was not touched"
  ok "images built"
fi

say "Starting the stack"
if ! "${COMPOSE[@]}" up -d --wait --wait-timeout 240; then
  bad "the stack did not become healthy"
  restore_rollback
  exit 1
fi
ok "all services healthy"

say "Synchronising indexes"
# Mongoose never drops an index it has stopped declaring; this is per release.
"${COMPOSE[@]}" exec -T backend node dist/sync-indexes.js \
  && ok "indexes in sync" || bad "index sync reported a problem (not fatal)"

if verify_live; then
  say "Deployed"
  ok "production is live and verified"
  exit 0
fi

bad "live verification failed"
restore_rollback
exit 1
