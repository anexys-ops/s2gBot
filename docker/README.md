# Déploiement Docker (production / serveur)

Stack : **Nginx** (SPA React + proxy) · **PHP-FPM 8.2** (Laravel) · **MySQL 8**.

## Démarrage rapide

```bash
cd /chemin/vers/s2gBot
cp docker/env.docker.example .env.docker
# Éditer .env.docker : APP_URL, mots de passe MySQL, et surtout APP_KEY (voir ci-dessous)

docker compose --env-file .env.docker up -d --build
```

Interface : `http://localhost:8080` (ou le port `HTTP_PORT` défini dans `.env.docker`).

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
