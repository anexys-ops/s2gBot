---
name: maj-prod-s2gbot
description: >-
  Met à jour le serveur de production s2gBot (Docker : Laravel + React). Déclencher
  sur demande explicite (MAJ prod, deploy, etc.) ou en fin de session quand l’utilisateur
  veut que chaque modification parte en prod (voir règle s2gbot-sync-prod-on-change).
  Couvre le workflow GitHub Actions « Deploy production » (push main → git pull +
  docker-prod-refresh) et le déploiement manuel (tar/SSH ou deploy-apps-dev.sh).
---

**SSH / hôte prod** : lire le fichier voisin **`SECRETS.local.md`** (non versionné, listé dans `.gitignore`). S’il est absent sur une machine : copier **`SECRETS.local.example.md`** → `SECRETS.local.md` et le remplir.

# MAJ production s2gBot

Tu es l’agent chargé d’exécuter ou d’orchestrer la mise à jour **production** de ce monorepo (API Laravel, front Vite, script `scripts/deploy-server.sh` côté serveur après `git pull`).

**Serveur de production (s2gBot)** : c’est la machine joignable en **SSH sur le port 167** (voir `port: 167` dans `.github/workflows/deploy.yml`). Quand l’utilisateur dit « prod » ou « serveur de production », il parle de **ce** serveur, pas d’un hôte au port 22 par défaut.

**Configuration infra validée** : stack **Docker** sur le LXC (`/opt/s2gBot`, site sur **port 80**, SSH **167**, etc.). **Ne pas** modifier cette configuration via SSH ni proposer de changements ports / `.env.docker` (sauf ligne `APP_VERSION` gérée par le workflow) / Nginx **sans demande explicite**. Déploiement courant = **`git push` sur `main`** → workflow **Deploy production** (`git pull` + `docker-prod-refresh.sh`) — voir `.cursor/rules/s2gbot-prod-ssh.mdc` et **s2gbot-sync-prod-on-change**.

## Sync immédiate après modifications (attendu utilisateur)

Quand l’utilisateur veut que **chaque changement parte en prod** : après les commits, **`git push origin main`** (le workflow reconstruit les images Docker). Si Actions n’est pas utilisable : sync SSH vers `/opt/s2gBot` puis `./scripts/docker-prod-refresh.sh` (comme avant), sans exposer les secrets.

**Prérequis Actions** : `DEPLOY_PATH` sur le serveur doit être un **clone Git** avec `origin` pointant sur ce dépôt (accès en lecture pour la machine). Sinon le job échoue : initialiser une fois sur le serveur (`git clone` dans `/opt/s2gBot` ou `git init` + `remote` + premier `pull`), conserver `.env.docker` hors dépôt ou restauré après clone.

## Avant toute chose

1. **Code prêt** : vérifier que les changements voulus sont commités ; la prod suit en général la branche `main` (voir `.github/workflows/deploy.yml`).
2. **Ne jamais** afficher ou journaliser le contenu de secrets (clés SSH, `.env`, `deploy.env`, secrets GitHub).
3. **Deux chemins** possibles — choisir celui que l’utilisateur utilise déjà ou demander en une phrase si besoin.

## Chemin A — GitHub Actions (recommandé si configuré)

Déclenché au **push sur `main`** ou manuellement via **workflow_dispatch**.

1. S’assurer que `main` contient les commits à déployer : `git status`, `git log -1 --oneline`, puis si nécessaire merge/push vers `origin main`.
2. Si l’utilisateur veut déclencher **sans nouveau push** : depuis la racine du dépôt, avec GitHub CLI authentifié :
   - `gh workflow run "Deploy production" --ref main`
3. Suivre l’exécution : `gh run list --workflow="Deploy production"` puis `gh run watch <id>` si utile.

**Secrets attendus côté dépôt** (documentés dans le workflow) : `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`. Sur le serveur : clone du repo, `laravel-api/.env`, `chmod +x scripts/deploy-server.sh`.

## Chemin B — Déploiement depuis la machine locale

Quand Actions n’est pas utilisé ou pour un déploiement direct rsync + commandes distantes :

1. Vérifier que `deploy.env` existe à la racine (copié depuis `scripts/deploy-apps-dev.example.env`, **non versionné** — voir `.gitignore`). Pour le **même serveur que GitHub Actions**, définir **`DEPLOY_PORT=167`** (en plus de `DEPLOY_HOST`, etc.).
2. Exécuter depuis la racine du dépôt :
   - `set -a && source deploy.env && set +a && ./scripts/deploy-apps-dev.sh`
3. Le script build le front en local, synchronise Laravel et `dist/` vers le serveur, puis lance Composer, migrations et caches sur le distant.

## Variable optionnelle serveur

Si le serveur publie le build dans un dossier web dédié : sur la machine distante, définir `DEPLOY_PUBLIC_HTML` avant d’appeler `deploy-server.sh` (voir en-tête de `scripts/deploy-server.sh`).

## Après déploiement

Indiquer à l’utilisateur de vérifier l’app (URL publique, `/api` ou santé Laravel) et les logs si quelque chose échoue. En cas d’échec du job SSH : relire la sortie du workflow ou du script, sans divulguer de secrets.
