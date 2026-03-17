#!/usr/bin/env bash
# Lance toute la plateforme s2gBot (Docker ou Node)

set -e
cd "$(dirname "$0")"

# Charger Node si installé via nvm, fnm ou dans un chemin courant
if ! command -v npm >/dev/null 2>&1; then
  if [ -f "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
  elif command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
  elif [ -x /opt/homebrew/bin/node ]; then
    export PATH="/opt/homebrew/bin:$PATH"
  elif [ -x /usr/local/bin/node ]; then
    export PATH="/usr/local/bin:$PATH"
  fi
fi

if command -v docker >/dev/null 2>&1; then
  echo "Lancement avec Docker..."
  docker compose up --build -d
  echo ""
  echo "Plateforme démarrée. Ouvre dans ton navigateur :"
  echo "  → Front : http://localhost:5173"
  echo "  → API  : http://localhost:3000"
  docker compose ps
  exit 0
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node/npm n'est pas installé sur cette machine."
  echo ""
  echo "Sans Docker, il faut installer Node.js, puis relancer : ./start.sh"
  echo ""
  echo "Méthode la plus simple (sans Homebrew) :"
  echo "  1. Ouvre https://nodejs.org dans ton navigateur"
  echo "  2. Télécharge la version LTS (bouton vert)"
  echo "  3. Ouvre le .pkg et suis l’installation"
  echo "  4. Ferme ce terminal, ouvre-en un nouveau, puis : ./start.sh"
  echo ""
  echo "Si tu as déjà Homebrew : brew install node"
  exit 1
fi

echo "Lancement en local avec Node..."
echo "Installation des dépendances..."

(cd services/api    && npm install --silent)
(cd services/back   && npm install --silent)
(cd services/calcul && npm install --silent)
(cd services/auth   && npm install --silent)
(cd apps/front      && npm install --silent)

echo "Démarrage des services (Ctrl+C pour tout arrêter)..."
echo ""

(cd services/api    && npm run dev) &
(cd services/back   && npm run dev) &
(cd services/calcul && npm run dev) &
(cd services/auth   && npm run dev) &
(cd apps/front     && npm run dev) &

echo "  → Front : http://localhost:5173"
echo "  → API   : http://localhost:3000"
echo ""

wait
