#!/usr/bin/env bash
# À exécuter sur le serveur Debian (root) : Nginx pour SPA React + API Laravel.
#
# Cas fréquent derrière une box (NAT) : le port 80 sur l’IP publique redirige vers HTTPS
# alors que le 443 n’est pas renvoyé vers cette machine → page blanche. Il faut soit
# ouvrir/transférer le 443 vers ce serveur + certificats, soit désactiver la redirection HTTPS sur la box.
#
# Usage :
#   bash scripts/server-ensure-nginx-debian.sh /var/www/s2gBot s2g.apps-dev.fr
# Variables optionnelles :
#   NGINX_HTTP_ONLY=1       — uniquement port 80, pas de bloc 443 (tests / NAT).
#   NGINX_SKIP_CERTBOT=1    — ne pas tenter Let’s Encrypt automatiquement.
#   NGINX_SSL_CHAIN / NGINX_SSL_KEY — chemins PEM explicites.

set -euo pipefail

REMOTE_PATH="${1:?Usage: $0 /var/www/s2gBot domaine.example.fr}"
DOMAIN="${2:?Usage: $0 /var/www/s2gBot domaine.example.fr}"
WEB_ROOT="$REMOTE_PATH/laravel-api/public"
SITE_PATH="/etc/nginx/sites-available/${DOMAIN}"
ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"

LE_CHAIN=""
LE_KEY=""

resolve_ssl_paths() {
  local cand
  if [ -n "${NGINX_SSL_CHAIN:-}" ] && [ -n "${NGINX_SSL_KEY:-}" ] && [ -f "$NGINX_SSL_CHAIN" ] && [ -f "$NGINX_SSL_KEY" ]; then
    LE_CHAIN="$NGINX_SSL_CHAIN"
    LE_KEY="$NGINX_SSL_KEY"
    return 0
  fi
  for cand in \
    "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" \
    "/etc/letsencrypt/live/${DOMAIN}-0001/fullchain.pem" \
    "/etc/letsencrypt/live/${DOMAIN}-0002/fullchain.pem"; do
    if [ -f "$cand" ] && [ -f "$(dirname "$cand")/privkey.pem" ]; then
      LE_CHAIN="$cand"
      LE_KEY="$(dirname "$cand")/privkey.pem"
      return 0
    fi
  done
  if [ -d /etc/letsencrypt/live ]; then
    for cand in /etc/letsencrypt/live/*/fullchain.pem; do
      [ -f "$cand" ] || continue
      [ -f "$(dirname "$cand")/privkey.pem" ] || continue
      case "$(dirname "$cand")" in *"${DOMAIN}"*)
        LE_CHAIN="$cand"
        LE_KEY="$(dirname "$cand")/privkey.pem"
        return 0
        ;;
      esac
    done
    for cand in /etc/letsencrypt/live/*/fullchain.pem; do
      if [ -f "$cand" ] && [ -f "$(dirname "$cand")/privkey.pem" ]; then
        LE_CHAIN="$cand"
        LE_KEY="$(dirname "$cand")/privkey.pem"
        echo "→ Certificat LE (premier dossier live/) : $(dirname "$cand")" >&2
        return 0
      fi
    done
  fi
  if [ -x /usr/sbin/nginx ]; then
    cand=$(/usr/sbin/nginx -T 2>/dev/null | awk '/ssl_certificate / && $2 !~ /ssl_certificate_key/ {gsub(/;/,"",$2); print $2; exit}')
    key=$(/usr/sbin/nginx -T 2>/dev/null | awk '/ssl_certificate_key / {gsub(/;/,"",$2); print $2; exit}')
    if [ -n "$cand" ] && [ -n "$key" ] && [ -f "$cand" ] && [ -f "$key" ]; then
      LE_CHAIN="$cand"
      LE_KEY="$key"
      echo "→ Certificats repris depuis nginx -T" >&2
      return 0
    fi
  fi
  return 1
}

try_certbot_webroot() {
  [ "${NGINX_SKIP_CERTBOT:-0}" = "1" ] && return 1
  apt-get install -y -qq certbot >/dev/null
  mkdir -p "$WEB_ROOT/.well-known/acme-challenge"
  chmod -R ugo+rX "$WEB_ROOT/.well-known" 2>/dev/null || true
  certbot certonly --webroot -w "$WEB_ROOT" -d "$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email \
    --keep-until-expiring 2>&1 && return 0
  return 1
}

write_vhost_http_only() {
  local fpm="$1"
  cat >"$SITE_PATH" <<EOF
# Généré par s2gBot server-ensure-nginx-debian.sh — HTTP uniquement — $(date -u +%Y-%m-%dT%H:%MZ)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    root ${WEB_ROOT};
    index index.html index.php;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    client_max_body_size 50M;

    location ^~ /.well-known/acme-challenge/ {
        allow all;
        default_type "text/plain";
    }

    location = /_nginx_ok {
        default_type text/plain;
        return 200 "nginx-ok\n";
    }

    # API / Sanctum : FastCGI direct vers index.php (REQUEST_URI inchangée — évite try_files + boucles 301 selon le chemin réseau)
    location ^~ /api {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$realpath_root/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_pass unix:${fpm};
        fastcgi_read_timeout 120s;
    }

    location ^~ /sanctum {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$realpath_root/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_pass unix:${fpm};
        fastcgi_read_timeout 120s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location = /index.php {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${fpm};
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 120s;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
EOF
}

write_vhost_https() {
  local fpm="$1"
  cat >"$SITE_PATH" <<EOF
# Généré par s2gBot server-ensure-nginx-debian.sh — HTTPS — $(date -u +%Y-%m-%dT%H:%MZ)
# ssl_stapling off : évite blocages OCSP sur certains réseaux.

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    root ${WEB_ROOT};
    index index.html index.php;

    ssl_certificate     ${LE_CHAIN};
    ssl_certificate_key ${LE_KEY};
    ssl_stapling off;
    ssl_stapling_verify off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    client_max_body_size 50M;

    location ^~ /.well-known/acme-challenge/ {
        allow all;
        default_type "text/plain";
    }

    location = /_nginx_ok {
        default_type text/plain;
        return 200 "nginx-ok\n";
    }

    location ^~ /api {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$realpath_root/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_pass unix:${fpm};
        fastcgi_read_timeout 120s;
    }

    location ^~ /sanctum {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$realpath_root/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_pass unix:${fpm};
        fastcgi_read_timeout 120s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location = /index.php {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${fpm};
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 120s;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}
EOF
}

if [ ! -d "$WEB_ROOT" ]; then
  echo "ERREUR: $WEB_ROOT introuvable." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx >/dev/null

FPM_SOCK=""
for s in /run/php/php8.2-fpm.sock /run/php/php8.3-fpm.sock /run/php/php-fpm.sock; do
  if [ -S "$s" ]; then
    FPM_SOCK="$s"
    break
  fi
done
if [ -z "$FPM_SOCK" ]; then
  echo "ERREUR: socket php-fpm introuvable sous /run/php/." >&2
  exit 1
fi

umask 022

if [ "${NGINX_HTTP_ONLY:-0}" = "1" ]; then
  echo "==> Mode NGINX_HTTP_ONLY=1 (port 80 seulement, pas de redirection HTTPS)."
  write_vhost_http_only "$FPM_SOCK"
else
  if resolve_ssl_paths; then
    echo "==> Certificats TLS trouvés, vhost HTTPS."
    write_vhost_https "$FPM_SOCK"
  else
    echo "==> Pas de certificat — tentative Let’s Encrypt (webroot sur $WEB_ROOT)…"
    if try_certbot_webroot && resolve_ssl_paths; then
      echo "==> Certificat obtenu, vhost HTTPS."
      write_vhost_https "$FPM_SOCK"
    else
      echo "" >&2
      echo "AVERTISSEMENT : pas de certificat TLS — déploiement en HTTP seul sur ce serveur." >&2
      echo "  - Si https:// reste vide : une box / proxy public redirige le port 80 vers HTTPS sans renvoyer le 443 vers cette machine." >&2
      echo "  - Corrigez le NAT : transférez le port 443 public vers le port 443 (ou 80 + TLS terminé ici) de cette machine." >&2
      echo "  - Ou désactivez la redirection HTTP→HTTPS sur la box / le reverse-proxy devant ce serveur." >&2
      echo "  - Ou placez un certificat et : NGINX_SSL_CHAIN=… NGINX_SSL_KEY=… puis relancez ce script." >&2
      echo "" >&2
      write_vhost_http_only "$FPM_SOCK"
    fi
  fi
fi

ln -sf "$SITE_PATH" "$ENABLED"
[ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "==> Nginx rechargé : $SITE_PATH → $WEB_ROOT (php-fpm $FPM_SOCK)"
echo "    Test local : curl -sS -m 3 http://127.0.0.1/_nginx_ok -H 'Host: ${DOMAIN}'"
echo "    Depuis le même LAN que le serveur : si https://${DOMAIN} boucle en 301, utilisez le DNS interne"
echo "    ou une entrée /etc/hosts vers l’IP LAN du serveur (NAT hairpin / double passage)."
