#!/bin/sh
# Applies drizzle/migrations/*.sql once each, in order, then makes sure the media bucket exists.
set -e
set -a; . /secrets/env; set +a
export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL="psql -v ON_ERROR_STOP=1 -h db -U supabase_admin -d postgres -q"

until $PSQL -c "select 1 from storage.buckets limit 1" >/dev/null 2>&1; do
  echo "[migrate] waiting for database + storage…"; sleep 2
done

$PSQL -c "create schema if not exists huddle_meta; create table if not exists huddle_meta.migrations(name text primary key, applied_at timestamptz default now());"

for f in $(ls /migrations/*.sql | sort); do
  name=$(basename "$f")
  done_already=$($PSQL -tAc "select 1 from huddle_meta.migrations where name='$name'")
  if [ "$done_already" = "1" ]; then continue; fi
  echo "[migrate] applying $name"
  $PSQL -1 -f "$f" -c "insert into huddle_meta.migrations(name) values ('$name')"
done

$PSQL -c "insert into storage.buckets(id, name, public) values ('media','media',false) on conflict (id) do nothing;"
echo "[migrate] database ready"
