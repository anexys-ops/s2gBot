#!/usr/bin/env bash
# Bootstrap du serveur de production s2gBot pour recevoir les déploiements GitHub Actions.
#
# À exécuter UNE SEULE FOIS sur le serveur (SSH port 167).
#
# Ce script :
#   1. Crée l'utilisateur de déploiement s'il n'existe pas (optionnel)
#   2. Génère une paire de clés ed25519 dédiée au déploiement
#   3. Autorise la clé publique dans authorized_keys
#   4. Affiche la clé PRIVÉE à copier dans GitHub Secrets → DEPLOY_SSH_KEY
#   5. Crée le répertoire DEPLOY_PATH
#   6. Prépare .env.docker
#
# Usage :
#   sudo DEPLOY_USER=deploy DEPLOY_PATH=/opt/s2gBot ./scripts/bootstrap-server-deploy.sh

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/s2gBot}"

echo "=========================================="
echo "  Bootstrap s2gBot deploy"
echo "=========================================="
echo "  Utilisateur : $DEPLOY_USER"
echo "  Chemin     : $DEPLOY_PATH"
echo "=========================================="

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "▶ Création de l'utilisateur $DEPLOY_USER"
  useradd -m -s /bin/bash "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER" 2>/dev/null || true
fi

USER_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
SSH_DIR="$USER_HOME/.ssh"
KEY_PATH="$SSH_DIR/s2gbot_deploy"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [ ! -f "$KEY_PATH" ]; then
  echo "▶ Génération clé ed25519 → $KEY_PATH"
  ssh-keygen -t ed25519 -N "" -f "$KEY_PATH" -C "s2gbot-deploy-$(date +%Y%m%d)"
fi

PUB_KEY=$(cat "$KEY_PATH.pub")
AUTH_FILE="$SSH_DIR/authorized_keys"
touch "$AUTH_FILE"
if ! grep -qxF "$PUB_KEY" "$AUTH_FILE"; then
  echo "$PUB_KEY" >> "$AUTH_FILE"
fi
chmod 600 "$AUTH_FILE" "$KEY_PATH"
chmod 644 "$KEY_PATH.pub"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR"

if [ ! -d "$DEPLOY_PATH" ]; then
  echo "▶ Création $DEPLOY_PATH"
  mkdir -p "$DEPLOY_PATH"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
fi

cat <<EOF

============================================================
  ✓ Bootstrap OK
============================================================

GitHub Secrets à configurer (Settings → Secrets → Actions) :

  DEPLOY_HOST = $(hostname -I 2>/dev/null | awk '{print $1}') (ou domaine public)
  DEPLOY_USER = $DEPLOY_USER
  DEPLOY_PATH = $DEPLOY_PATH
  DEPLOY_SSH_KEY = (voir ci-dessous)

------------------ CLÉ PRIVÉE (DEPLOY_SSH_KEY) ------------------
$(cat "$KEY_PATH")
-----------------------------------------------------------------

⚠️  Copier la clé privée COMPLÈTE (incluant BEGIN/END) dans
    GitHub → Settings → Secrets → DEPLOY_SSH_KEY.

    Ensuite supprimer le contenu de ce terminal (clear) et NE JAMAIS
    exposer cette clé. La clé publique est autorisée côté serveur,
    rien d'autre à faire ici.

Test depuis votre machine (doit demander sans mot de passe) :
  ssh -i ~/.ssh/s2gbot_deploy_test -p 167 $DEPLOY_USER@<HOST> "echo OK"

EOF
