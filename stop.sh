#!/usr/bin/env bash
# Arrête tous les services lancés par relaunch.sh

cd "$(dirname "$0")"
RUN_DIR=".run"

echo "Arrêt des services..."

if [ -f "$RUN_DIR/pids" ]; then
  while read -r pid; do
    [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true
  done < "$RUN_DIR/pids"
  rm -f "$RUN_DIR/pids"
fi

# Libérer les ports au cas où
for port in 3000 3001 3002 3003 5173 5174 8000; do
  pid=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
  fi
done

echo "Services arrêtés."
