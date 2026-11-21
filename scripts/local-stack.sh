#!/usr/bin/env bash
# Docker-free local backend for development and end-to-end testing:
# Supabase Auth (GoTrue) + PostgREST (+ optionally Supabase Storage) against a local Postgres,
# behind a proxy that mimics the Supabase URL layout (http://localhost:54321/{auth,rest,storage}/v1).
# No Realtime.
#
# Prefer `supabase start` when Docker is available. This exists for CI sandboxes and
# machines without Docker.
#
#   scripts/local-stack.sh setup   # download binaries, create DB, apply migrations, write .env.local
#   scripts/local-stack.sh start   # start auth, rest, proxy, smtp sink (background; logs in .local-stack/)
#   scripts/local-stack.sh stop
#
# Requires: psql/createdb with a superuser connection via PG* env vars, Node, Python 3
# (optional, for the SMTP sink: `pip install aiosmtpd`). Emails land in .local-stack/mail/.
#
# Storage is optional: point STORAGE_API_DIR at a built checkout of github.com/supabase/storage
# (`npm ci && npm run build`; needs Node >= 26, set STORAGE_NODE to that binary). Files are kept
# in .local-stack/storage/. Without it, the stub storage schema is used and uploads fail.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.local-stack"
DB_NAME="${LOCAL_STACK_DB:-bizflow_local}"
AUTH_VERSION="${AUTH_VERSION:-v2.198.0}"
POSTGREST_VERSION="${POSTGREST_VERSION:-v16.6}"
JWT_SECRET="${LOCAL_STACK_JWT_SECRET:-local-stack-jwt-secret-at-least-32-characters}"
PGHOST_="${PGHOST:-localhost}"
PGPORT_="${PGPORT:-5432}"
PGUSER_="${PGUSER:-$(whoami)}"
PGPASSWORD_="${PGPASSWORD:-}"
AUTHENTICATOR_PASSWORD="${AUTHENTICATOR_PASSWORD:-authenticator-local}"
STORAGE_API_DIR="${STORAGE_API_DIR:-}"
STORAGE_NODE="${STORAGE_NODE:-node}"

mkdir -p "$DIR/mail"
db_url() { echo "postgres://${PGUSER_}${PGPASSWORD_:+:$PGPASSWORD_}@${PGHOST_}:${PGPORT_}/${DB_NAME}?sslmode=disable$1"; }

sign_jwt() {
  JWT_SECRET="$JWT_SECRET" ROLE="$1" node -e '
    const c = require("node:crypto");
    const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const h = b({ alg: "HS256", typ: "JWT" });
    const p = b({ iss: "local-stack", role: process.env.ROLE, exp: Math.floor(Date.now() / 1000) + 315360000 });
    const s = c.createHmac("sha256", process.env.JWT_SECRET).update(h + "." + p).digest("base64url");
    process.stdout.write(h + "." + p + "." + s);'
}

download() {
  cd "$DIR"
  if [[ ! -x auth ]]; then
    curl -fsSL -o auth.tar.xz "https://github.com/supabase/auth/releases/download/${AUTH_VERSION}/auth-${AUTH_VERSION}-amd64.tar.xz"
    tar xf auth.tar.xz && rm auth.tar.xz
  fi
  if [[ ! -x postgrest ]]; then
    curl -fsSL -o postgrest.tar.xz "https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x86-64.tar.xz"
    tar xf postgrest.tar.xz && rm postgrest.tar.xz
  fi
}

auth_env() {
  export GOTRUE_DB_DRIVER=postgres GOTRUE_DB_NAMESPACE=auth
  export DATABASE_URL; DATABASE_URL="$(db_url '&search_path=auth')"
  export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
  export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
  export GOTRUE_SITE_URL="http://localhost:3000" GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**"
  export API_EXTERNAL_URL="http://localhost:54321/auth/v1" GOTRUE_API_HOST=127.0.0.1 PORT=9999
  export GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true
  export GOTRUE_MAILER_AUTOCONFIRM="${LOCAL_STACK_AUTOCONFIRM:-true}"
  export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2525 GOTRUE_SMTP_ADMIN_EMAIL=noreply@bizflow.local
  export GOTRUE_SMTP_SENDER_NAME=BizFlow GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
  export GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
}

storage_enabled() { [[ -n "$STORAGE_API_DIR" && -f "$STORAGE_API_DIR/dist/start/server.js" ]]; }

storage_serve() {
  mkdir -p "$DIR/storage"
  cd "$STORAGE_API_DIR"
  exec env -i HOME="$HOME" PATH="$(dirname "$(command -v "$STORAGE_NODE")"):/usr/bin:/bin" NODE_ENV=production \
    SERVER_HOST=127.0.0.1 SERVER_PORT=5000 SERVER_ADMIN_PORT=5001 \
    AUTH_JWT_SECRET="$JWT_SECRET" AUTH_JWT_ALGORITHM=HS256 \
    DATABASE_URL="$(db_url '')" DB_INSTALL_ROLES=false DB_SUPER_USER="$PGUSER_" \
    DB_ANON_ROLE=anon DB_SERVICE_ROLE=service_role DB_AUTHENTICATED_ROLE=authenticated \
    STORAGE_BACKEND=file STORAGE_FILE_BACKEND_PATH="$DIR/storage" GLOBAL_S3_BUCKET=bizflow \
    TENANT_ID=local REGION=local UPLOAD_FILE_SIZE_LIMIT=52428800 LOG_LEVEL=warn \
    "$STORAGE_NODE" "$STORAGE_API_DIR/dist/start/server.js"
}

setup() {
  download
  dropdb --if-exists "$DB_NAME"
  createdb "$DB_NAME"
  psql -qX -d "$DB_NAME" -c "create schema auth"
  (auth_env && "$DIR/auth" migrate)

  local PSQL=(psql -v ON_ERROR_STOP=1 -qX -d "$DB_NAME")
  "${PSQL[@]}" -c "do \$\$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
    end \$\$;"
  if storage_enabled; then
    # The storage server migrates its schema on startup; run it once until that is done.
    (storage_serve) > "$DIR/storage-setup.log" 2>&1 &
    local pid=$!
    for _ in $(seq 1 60); do
      if curl -fsS http://127.0.0.1:5000/status > /dev/null 2>&1; then break; fi
      sleep 1
    done
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    "${PSQL[@]}" -tAc "select count(*) from storage.migrations" > /dev/null
  fi
  "${PSQL[@]}" -f "$ROOT/supabase/tests/local/supabase_stub.sql"
  "${PSQL[@]}" -c "do \$\$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticator') then
        create role authenticator;
      end if;
    end \$\$;
    alter role authenticator login noinherit password '${AUTHENTICATOR_PASSWORD}';
    grant anon, authenticated, service_role to authenticator;"
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    "${PSQL[@]}" --single-transaction -f "$migration"
  done

  if [[ -f "$ROOT/.env.local" ]]; then cp "$ROOT/.env.local" "$ROOT/.env.local.bak"; fi
  cat > "$ROOT/.env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(sign_jwt anon)
SUPABASE_SERVICE_ROLE_KEY=$(sign_jwt service_role)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF
  echo "local stack ready: database $DB_NAME, .env.local written"
}

start() {
  cd "$DIR"
  (auth_env && nohup ./auth serve > auth.log 2>&1 & echo $! > auth.pid)
  PGRST_DB_URI="postgres://authenticator:${AUTHENTICATOR_PASSWORD}@${PGHOST_}:${PGPORT_}/${DB_NAME}" \
    PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
    PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=3001 \
    nohup ./postgrest > postgrest.log 2>&1 & echo $! > postgrest.pid
  if storage_enabled; then
    (storage_serve > "$DIR/storage.log" 2>&1 & echo $! > "$DIR/storage.pid")
  fi
  nohup node -e '
    const http = require("node:http");
    const routes = [["/auth/v1", 9999], ["/rest/v1", 3001], ["/storage/v1", 5000]];
    http.createServer((req, res) => {
      const m = routes.find(([p]) => req.url.startsWith(p));
      if (!m) { res.writeHead(404); return res.end(); }
      const up = http.request({ host: "127.0.0.1", port: m[1], path: req.url.slice(m[0].length) || "/",
        method: req.method, headers: { ...req.headers, host: "127.0.0.1:" + m[1] } },
        (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
      up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
      req.pipe(up);
    }).listen(54321, "127.0.0.1");' > proxy.log 2>&1 & echo $! > proxy.pid
  if python3 -c "import aiosmtpd" 2>/dev/null; then
    nohup python3 -c '
import asyncio, pathlib, time
from aiosmtpd.controller import Controller
class H:
    async def handle_DATA(self, server, session, envelope):
        (pathlib.Path("mail") / f"{time.time():.3f}.eml").write_bytes(envelope.content)
        return "250 OK"
Controller(H(), hostname="127.0.0.1", port=2525).start()
asyncio.new_event_loop().run_forever()' > smtp.log 2>&1 & echo $! > smtp.pid
  fi
  sleep 2
  curl -fsS http://localhost:54321/auth/v1/health > /dev/null && echo "auth + rest up on http://localhost:54321"
  if storage_enabled; then
    for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:5000/status > /dev/null 2>&1 && break; sleep 1; done
    curl -fsS http://127.0.0.1:5000/status > /dev/null && echo "storage up on http://localhost:54321/storage/v1"
  fi
}

stop() {
  cd "$DIR"
  for f in *.pid; do [[ -f "$f" ]] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
  echo "stopped"
}

case "${1:-}" in
  setup) setup ;;
  start) start ;;
  stop) stop ;;
  *) echo "usage: $0 {setup|start|stop}" >&2; exit 1 ;;
esac
