# Plateforme s2gBot — laboratoire géotechnique / BTP

![Tests](https://github.com/anexys-ops/s2gBot/actions/workflows/tests.yml/badge.svg?branch=main)

**Partage (Git)** : voir [PUSH.md](PUSH.md). | CI : [docs/CI.md](docs/CI.md) | Protection `main` : [docs/GITHUB-BRANCH-PROTECTION.md](docs/GITHUB-BRANCH-PROTECTION.md)

## Une seule application web

Tout passe par **Laravel 11** (API) + **React 18** (interface unique) :

- **Backend** : [laravel-api/](laravel-api/) — REST, Sanctum, SQLite / MySQL / PostgreSQL  
- **Frontend** : [react-frontend/](react-frontend/) — Vite, React Router, React Query  
- **Mobile (stores)** : [apps/lab-btp-mobile/](apps/lab-btp-mobile/) — Expo, API Sanctum (iOS / Android)  

Dans l’interface, deux espaces métier coexistent (même URL, onglets distincts possibles) :

| Espace | URL | Usage |
|--------|-----|--------|
| **CRM** | http://localhost:5173/crm | Clients, chantiers, devis, factures, mails, PDF |
| **Terrain & labo** | http://localhost:5173/terrain | Commandes, saisie mesures (détail dossier), catalogue, graphiques, calculs |

Documentation détaillée : [LAB-BTP-README.md](LAB-BTP-README.md).  
Démarrage express : [DEMARRAGE-BTP.md](DEMARRAGE-BTP.md).  
Comparaison Dolibarr : [docs/DOLIBARR-VS-PLATEFORME-BTP.md](docs/DOLIBARR-VS-PLATEFORME-BTP.md).

---

## Démarrage rapide (recommandé)

```bash
./start.sh
```

ou :

```bash
./start-btp.sh
```

Puis ouvrir **http://localhost:5173** (compte démo : `admin@lab.local` / `password`).

En arrière-plan avec logs dans `.run/` :

```bash
./relaunch.sh
./stop.sh
```

---

## Dossier `services/` (Node)

Les anciens microservices Node (`services/api`, `back`, `calcul`, `auth`) ne sont **plus** lancés par les scripts par défaut. La plateforme produit repose sur **laravel-api** + **react-frontend**. Vous pouvez conserver ce dossier comme référence ou le retirer du dépôt si vous n’en avez plus l’usage.

---

## Docker (serveur / prod)

Stack **MySQL + PHP-FPM + Nginx** (React buildé). Guide : [docker/README.md](docker/README.md).

```bash
cp docker/env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker exec app php artisan db:seed --force
```

En local, `./start.sh` reste possible sans Docker.

---

## Déploiement production (serveur SSH port **167**)

Pour ce projet, le **serveur de production** est celui atteint en **SSH sur le port 167** (configuré dans [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) pour le job *Deploy production*).

- **Via Git** : un `git push` sur `main` déclenche GitHub Actions, qui se connecte à ce serveur en **port 167**, met à jour le dépôt sur le disque (`DEPLOY_PATH`) et exécute `scripts/deploy-server.sh`.
- **Depuis ta machine** : copier `scripts/deploy-apps-dev.example.env` vers `deploy.env`, renseigner l’hôte et **`DEPLOY_PORT=167`**, puis lancer `./scripts/deploy-apps-dev.sh` (voir commentaires dans l’exemple d’env).

**Versions footer (automatique)** : le numéro **API** suit **`react-frontend/package.json`** si `APP_VERSION` est vide dans `.env` ; les scripts **`deploy-server.sh`** et **`deploy-apps-dev.sh`** mettent à jour `APP_VERSION` dans `.env` à chaque déploiement. Le **commit** affiché sur le front est injecté via **`GIT_COMMIT_SHORT`** pendant le build sur le serveur. Après un déploiement, un **hard refresh** (ou mise à jour du service worker) peut être nécessaire pour voir le nouveau bundle.
