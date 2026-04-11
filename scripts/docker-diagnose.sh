#!/usr/bin/env bash
# Diagnostic stack Docker s2gBot (à lancer sur le serveur, racine du dépôt).
# Ne affiche pas le contenu de .env.docker — colle la sortie pour support / debug.
#
#   chmod +x scripts/docker-diagnose.sh && ./scripts/docker-diagnose.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_DOCKER_FILE:-.env.docker}"

echo "========== s2gBot docker-diagnose =========="
echo "Date : $(date -Iseconds 2>/dev/null || date)"
echo "Répertoire : $ROOT"
echo ""

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERREUR : $ENV_FILE absent"
  exit 1
fi

# Port HTTP publié (variable du compose, sans sourcer les secrets en clair)
HTTP_PORT=$(grep -E '^HTTP_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)
HTTP_PORT="${HTTP_PORT:-8080}"

DC=(docker compose --env-file "$ENV_FILE")

echo "---------- docker compose ps ----------"
"${DC[@]}" ps -a || true
echo ""

echo "---------- Écoute des ports (8080 / HTTP_PORT courant) ----------"
ss -lntp 2>/dev/null | grep -E ":${HTTP_PORT}|:8080|:80 " || true
echo ""

echo "---------- curl depuis l'hôte (127.0.0.1) ----------"
for path in / /api/version /up; do
  code=$(curl -sS -o /tmp/s2gdiag_body.txt -w "%{http_code}" --connect-timeout 5 "http://127.0.0.1:${HTTP_PORT}${path}" || echo "ERR")
  echo "GET http://127.0.0.1:${HTTP_PORT}${path} -> HTTP $code"
  if [[ "$path" == "/api/version" ]] && [[ "$code" == "200" ]]; then
    head -c 200 /tmp/s2gdiag_body.txt | tr '\n' ' '
    echo
  fi
done
rm -f /tmp/s2gdiag_body.txt
echo ""

echo "---------- Derniers logs app (50 lignes) ----------"
"${DC[@]}" logs app --tail 50 2>&1 || true
echo ""

echo "---------- Derniers logs web (30 lignes) ----------"
"${DC[@]}" logs web --tail 30 2>&1 || true
echo ""

echo "---------- Variables utiles (.env.docker, sans mots de passe) ----------"
grep -E '^(HTTP_PORT|APP_ENV|APP_DEBUG|APP_URL|FRONTEND_URL|RUN_OPTIMIZE|RUN_SEED)=' "$ENV_FILE" 2>/dev/null | sed 's/APP_DEBUG=.*/APP_DEBUG=<masqué si besoin>/' || true
echo ""
echo "========== Fin diagnostic =========="
