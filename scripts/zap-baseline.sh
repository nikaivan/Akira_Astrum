#!/usr/bin/env bash
# Escaneo OWASP ZAP en modo baseline (Fase 3, E). Es PASIVO: rastrea la aplicación y analiza las respuestas, no ataca.
#   npm run zap
# Requisitos: Docker, curl y un archivo .env.test.local con el proyecto de Supabase de TEST (nunca producción).
# Escanea el build de producción en local (la CSP y las cabeceras reales solo existen ahí). No escanea la intranet (sin sesión).
# Informes en zap-reports/ (HTML y JSON), carpeta ignorada por Git.
set -euo pipefail

PORT=3300
ENV_FILE=".env.test.local"
IMAGE="ghcr.io/zaproxy/zaproxy:stable"
SERVER_PID=""

# Lee una sola variable del archivo (sin cargarlo entero en el entorno) y sin imprimirla.
read_var() {
  grep -E "^$1=" "$ENV_FILE" | head -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

[ -f "$ENV_FILE" ] || { echo "Falta el archivo del proyecto de test." >&2; exit 1; }

SUPABASE_TEST_PROJECT_REF="$(read_var SUPABASE_TEST_PROJECT_REF)"
SUPABASE_TEST_URL="$(read_var SUPABASE_TEST_URL)"
SUPABASE_TEST_ANON_KEY="$(read_var SUPABASE_TEST_ANON_KEY)"

# Misma guarda que los e2e y los tests de integración: solo el proyecto de test.
if [ -z "$SUPABASE_TEST_PROJECT_REF" ] || [ "$SUPABASE_TEST_URL" != "https://${SUPABASE_TEST_PROJECT_REF}.supabase.co" ]; then
  echo "El entorno no es el del proyecto de test: abortando." >&2
  exit 1
fi

# La aplicación solo recibe las dos variables públicas.
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_TEST_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_TEST_ANON_KEY"

# Linux comparte la red del anfitrión; en macOS y Windows el contenedor llega al anfitrión por host.docker.internal.
if [ "$(uname -s)" = "Linux" ]; then
  NETWORK_FLAG="--network host"
  TARGET="http://localhost:${PORT}"
else
  NETWORK_FLAG=""
  TARGET="http://host.docker.internal:${PORT}"
fi

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    pkill -P "$SERVER_PID" 2>/dev/null || true
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

mkdir -p zap-reports
chmod a+w zap-reports

echo "Compilando el build de producción..."
npm run build

echo "Arrancando la aplicación en el puerto ${PORT}..."
npm start -- --port "$PORT" > zap-reports/server.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://localhost:${PORT}/login"; then break; fi
  sleep 1
done
curl -fsS -o /dev/null "http://localhost:${PORT}/login" || { echo "La aplicación no ha arrancado." >&2; exit 1; }

echo "Ejecutando ZAP baseline contra ${TARGET} (unos minutos)..."
ZAP_STATUS=0
# shellcheck disable=SC2086
docker run --rm ${NETWORK_FLAG} -v "${PWD}/zap-reports:/zap/wrk:rw" "$IMAGE" zap-baseline.py -t "$TARGET" -m 3 -r zap-baseline.html -J zap-baseline.json -I || ZAP_STATUS=$?

echo "Informes en zap-reports/zap-baseline.html y zap-reports/zap-baseline.json (código de salida de ZAP: ${ZAP_STATUS})."
exit "$ZAP_STATUS"
