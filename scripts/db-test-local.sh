#!/usr/bin/env bash
# Applies all migrations to a throwaway database on a plain local Postgres (with a
# Supabase compatibility stub) and runs the SQL behaviour tests.
#
# Usage: scripts/db-test-local.sh            (uses PG* env vars / local socket)
#        DB_NAME=my_test scripts/db-test-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${DB_NAME:-bizflow_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -X -q -d "$DB_NAME")

dropdb --if-exists "$DB_NAME"
createdb "$DB_NAME"

"${PSQL[@]}" -f "$ROOT/supabase/tests/local/supabase_stub.sql"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$migration")"
  "${PSQL[@]}" --single-transaction -f "$migration"
done

echo "re-applying reference data (idempotency check)"
"${PSQL[@]}" --single-transaction -f "$ROOT/supabase/migrations/20261121000900_seed_reference_data.sql"

"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/local/rls_and_rpc_tests.sql" 2>&1 \
  | sed -E 's/^psql:[^ ]+ NOTICE: +//'

if [[ "${KEEP_DB:-0}" != "1" ]]; then
  dropdb "$DB_NAME"
fi
