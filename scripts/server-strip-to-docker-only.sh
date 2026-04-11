#!/usr/bin/env bash
# À exécuter sur le serveur (root) : supprime le déploiement hôte s2gBot (Nginx + PHP-FPM + /var/www/s2gBot)
# et ne garde que la stack Docker sous /opt/s2gBot (ou autre ROOT).
#
# ATTENTION : désinstalle nginx et php8.2-fpm (apt purge) — ne pas lancer si d’autres sites PHP/nginx
# tournent sur la même machine.
#
# Usage :
#   export S2G_ROOT=/opt/s2gBot   # défaut
#   bash scripts/server-strip-to-docker-only.sh

set -euo pipefail
S2G_ROOT="${S2G_ROOT:-/opt/s2gBot}"

echo "=== Arrêt services hôte s2gBot (stop.sh, ports 8000/5173) ==="
if [ -x "$S2G_ROOT/stop.sh" ]; then
  "$S2G_ROOT/stop.sh" || true
fi
for p in 8000 5173 5174; do
  pid=$(lsof -ti ":$p" 2>/dev/null || true)
  if [ -n "${pid:-}" ]; then kill -9 $pid 2>/dev/null || true; fi
done

echo "=== Retrait vhost Nginx s2g ==="
rm -f /etc/nginx/sites-enabled/s2g.apps-dev.fr
rm -f /etc/nginx/sites-available/s2g.apps-dev.fr
rm -f /etc/nginx/sites-available/s2g.apps-dev.fr.bak*

if [ -d /etc/nginx/sites-enabled ] && [ -z "$(ls -A /etc/nginx/sites-enabled 2>/dev/null)" ]; then
  echo "=== sites-enabled vide — purge nginx ==="
  systemctl stop nginx 2>/dev/null || true
  systemctl disable nginx 2>/dev/null || true
  DEBIAN_FRONTEND=noninteractive apt-get purge -y nginx nginx-common 2>/dev/null || true
elif command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx
fi

echo "=== Suppression /var/www/s2gBot ==="
rm -rf /var/www/s2gBot

echo "=== Arrêt / purge php8.2-fpm hôte ==="
systemctl stop php8.2-fpm 2>/dev/null || true
systemctl disable php8.2-fpm 2>/dev/null || true
DEBIAN_FRONTEND=noninteractive apt-get purge -y php8.2-fpm 2>/dev/null || true

echo "=== Certificat Let’s Encrypt s2g (optionnel) ==="
certbot delete --cert-name s2g.apps-dev.fr --noninteractive 2>/dev/null || true

apt-get autoremove -y -qq 2>/dev/null || true

echo "=== Relancer Docker (si compose présent) ==="
if [ -f "$S2G_ROOT/docker-compose.yml" ]; then
  (cd "$S2G_ROOT" && docker compose --env-file "${ENV_DOCKER_FILE:-.env.docker}" up -d) || true
fi

echo "=== Terminé. Interface Docker typique : http://IP:\${HTTP_PORT}/ (ex. :167) ==="
