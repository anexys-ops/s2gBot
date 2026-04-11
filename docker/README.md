# Déploiement Docker (production / serveur)

Trois services dans `docker-compose.yml` :

| Service | Rôle |
|--------|------|
| **web** | Nginx : fichiers React + proxy FastCGI vers Laravel pour `/api`, `/sanctum`, `/up` |
| **app** | PHP-FPM 8.4 + Laravel (API) ; parle à MySQL via le hostname Docker `db` |
| **db** | MySQL 8 (persistance volume `mysql_data`) |

Stack : **Nginx** · **PHP-FPM 8.4** (Laravel / API) · **MySQL 8**.

## Démarrage rapide

```bash
cd /chemin/vers/s2gBot
cp docker/env.docker.example .env.docker
# Éditer .env.docker : APP_URL, mots de passe MySQL, et surtout APP_KEY (voir ci-dessous)

docker compose --env-file .env.docker up -d --build
```

Interface : `http://localhost:8080` (ou le port `HTTP_PORT` défini dans `.env.docker`).

**API** : même URL et port que l’interface ; préfixes HTTP `/api/...`, `/sanctum/...`, santé `/up`.

**MySQL depuis l’hôte** (administration locale au serveur, pas exposé sur Internet si vous gardez `127.0.0.1`) : `127.0.0.1:${MYSQL_PUBLISH_PORT:-33060}` (utilisateur / mot de passe = `DB_USERNAME` / `DB_PASSWORD` dans `.env.docker`). Depuis un autre poste : tunnel SSH puis client MySQL sur ce port.

### Comptes démo

Après le premier démarrage :

```bash
docker compose --env-file .env.docker exec app php artisan db:seed --force
```

Connexion type : `admin@lab.local` / `password` (voir `DatabaseSeeder`).

### APP_KEY stable (important)

Sans `APP_KEY` fixe, un redémarrage peut en générer une nouvelle et invalider les sessions / tokens chiffrés.

Générer une clé et la coller dans `.env.docker` :

```bash
docker compose --env-file .env.docker run --rm app php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
```

Puis redémarrer : `docker compose --env-file .env.docker up -d`.

### HTTPS derrière un reverse proxy

Renseignez `APP_URL=https://votre-domaine.fr` et ajoutez le hostname dans `SANCTUM_STATEFUL_DOMAINS`.  
`TrustProxies` est déjà configuré côté Laravel pour les en-têtes `X-Forwarded-*`.

### Volumes

- `mysql_data` : base MySQL  
- `laravel_storage` : `storage/` (fichiers, logs, cache)  
- `laravel_bootstrap_cache` : caches Laravel

### Désactiver les caches Laravel (debug)

Dans `.env.docker` : `RUN_OPTIMIZE=0`.

### Seed au premier boot (optionnel)

`RUN_SEED=1` dans `.env.docker` exécute `db:seed` à chaque démarrage du conteneur **app** — à éviter en prod une fois les données réelles en place.

### Docker (`/opt/s2gBot`) vs Nginx + PHP sur l’hôte (`/var/www/s2gBot`)

Ce sont **deux déploiements distincts** :

| Emplacement | Fichier d’env | Où lancer Artisan |
|-------------|----------------|-------------------|
| **Docker** (`docker compose` dans `/opt/s2gBot`) | **`.env.docker`** à la racine | `./scripts/docker-artisan.sh …` (conteneur `app`) |
| **Hôte** (Nginx + php-fpm, ex. `s2g.apps-dev.fr`) | **`laravel-api/.env`** sous `/var/www/...` | `cd …/laravel-api && php artisan …` |

Si tu utilises **uniquement Docker** sur le serveur, **`php artisan` dans `/var/www/s2gBot`** ne met **pas** à jour l’app dans les conteneurs.

Pour **supprimer** l’ancien déploiement hôte (Nginx + PHP + `/var/www/s2gBot`) et ne garder que Docker : **`scripts/server-strip-to-docker-only.sh`** (à lancer une fois sur le serveur, en root — voir avertissements dans le script).

Après **changement de `.env.docker`**, il faut **recréer** le service `app` pour recharger les variables, puis recacher la config :

```bash
./scripts/docker-env-apply.sh
```

Ou à la main : `docker compose --env-file .env.docker up -d --force-recreate app`

### Après une mise à jour du code (prod)

Les caches Laravel vivent dans le volume **`laravel_bootstrap_cache`** ; le front buildé est dans l’image **web**. Après un `git pull` (ou un déploiement qui ne reconstruit pas les images), exécuter sur le serveur :

```bash
cd /chemin/vers/s2gBot
./scripts/docker-prod-refresh.sh
```

Cela exécute `php artisan optimize:clear` dans **app**, puis `docker compose up -d --build --force-recreate app web` (la base **db** n’est pas recréée). Au redémarrage, `docker-entrypoint.sh` relance migrations et régénère les caches si `RUN_OPTIMIZE=1`.

En cas de problème après déploiement : `./scripts/docker-diagnose.sh` (sur le serveur, même répertoire que `.env.docker`) — à copier sur la machine si le dépôt n’est pas à jour, puis coller la sortie pour analyse.
