#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
local_root="$root/.local"
data_dir="$local_root/postgres"
log_dir="$local_root/logs"
port="${LOCAL_DATABASE_PORT:-5433}"
db_name="reviewflow_local"
db_user="reviewflow"
backend_port="${LOCAL_API_PORT:-8081}"
java_home="${REVIEWFLOW_JAVA_HOME:-/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home}"

mkdir -p "$log_dir"

backend_running() {
  local code
  code="$(curl --silent --output /dev/null --write-out "%{http_code}" --max-time 2 "http://127.0.0.1:$backend_port/actuator/health" || true)"
  [[ "$code" != "000" && -n "$code" ]]
}

status() {
  if pg_ctl -D "$data_dir" status >/dev/null 2>&1; then echo "PostgreSQL: running on 127.0.0.1:$port"; else echo "PostgreSQL: stopped"; fi
  if backend_running; then echo "Spring API: running on http://127.0.0.1:$backend_port"; else echo "Spring API: stopped"; fi
}

if [[ "${1:-}" == "status" ]]; then status; exit 0; fi

if [[ ! -f "$data_dir/PG_VERSION" ]]; then initdb --no-locale --encoding=UTF8 --auth=trust --username="$db_user" --pgdata="$data_dir" >/dev/null; fi
if ! pg_ctl -D "$data_dir" status >/dev/null 2>&1; then pg_ctl -D "$data_dir" -l "$log_dir/postgres.log" -o "-p $port -h 127.0.0.1" start >/dev/null; fi
if ! psql --host=127.0.0.1 --port="$port" --username="$db_user" --dbname=postgres --tuples-only --no-align -c "SELECT 1 FROM pg_database WHERE datname='$db_name'" | grep -qx 1; then createdb --host=127.0.0.1 --port="$port" --username="$db_user" "$db_name"; fi

if ! backend_running; then
  if [[ ! -d "$java_home" ]]; then echo "Java 21 is required. Set REVIEWFLOW_JAVA_HOME to a JDK 21 installation." >&2; exit 1; fi
  (cd "$root/backend" && JAVA_HOME="$java_home" DATABASE_URL="jdbc:postgresql://127.0.0.1:$port/$db_name" DATABASE_USER="$db_user" DATABASE_PASSWORD="" SERVER_PORT="$backend_port" JWT_SECRET="${JWT_SECRET:-local-development-secret-change-before-sharing}" gradle bootRun >"$log_dir/backend.log" 2>&1) &
  backend_pid=$!
  for _ in {1..45}; do
    if backend_running; then break; fi
    if ! kill -0 "$backend_pid" 2>/dev/null; then echo "Local Spring API failed to start. See $log_dir/backend.log" >&2; exit 1; fi
    sleep 1
  done
fi
if ! backend_running; then echo "Local Spring API did not become reachable. See $log_dir/backend.log" >&2; exit 1; fi

echo "Local ReviewFlow is ready: Postgres on :$port, API on :$backend_port, web on :3000."
echo "All local data is stored under $local_root and is ignored by Git."
REVIEWFLOW_LOCAL_BACKEND=true LOCAL_API_URL="http://127.0.0.1:$backend_port" NEXT_PUBLIC_SITE_URL="http://localhost:3000" npm run dev
