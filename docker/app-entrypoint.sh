#!/bin/sh
# Builds the web app with this install's keys (first start / after config change), then serves it.
set -e
set -a; . /secrets/env; set +a

export VITE_SUPABASE_URL="${PUBLIC_API_URL:-http://localhost:8000}"
export VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export VITE_SUPABASE_PROJECT_ID="huddle"
export VITE_ENABLE_GOOGLE_AUTH="${ENABLE_GOOGLE_AUTH:-false}"
export VITE_DONATE_URL="${DONATE_URL:-https://github.com/sponsors/orendrasingh}"
export SUPABASE_URL="http://kong:8000"
export SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export NITRO_PRESET=node-server

stamp="$VITE_SUPABASE_URL|$ANON_KEY|$VITE_ENABLE_GOOGLE_AUTH|$VITE_DONATE_URL"
if [ ! -f .output/.stamp ] || [ "$(cat .output/.stamp)" != "$stamp" ]; then
  echo "[huddle] building app for $VITE_SUPABASE_URL (takes a minute on first start)…"
  bun run build
  echo "$stamp" > .output/.stamp
fi

# When the public API address is localhost, forward it to the gateway so server-side rendering works too.
case "$VITE_SUPABASE_URL" in
  http://localhost:*|http://127.0.0.1:*)
    node /app/docker/local-proxy.mjs "${VITE_SUPABASE_URL##*:}" kong 8000 &
    ;;
esac

unset JWT_SECRET POSTGRES_PASSWORD SECRET_KEY_BASE DB_ENC_KEY
exec node .output/server/index.mjs
