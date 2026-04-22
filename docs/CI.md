# CI et couverture de tests (s2gBot)

Le workflow GitHub Actions [`.github/workflows/tests.yml`](../.github/workflows/tests.yml) exécute :

1. **Laravel** (`laravel-api`) — `composer install` puis `php artisan test --coverage --min=60` (échec CI si la couverture de lignes du périmètre `phpunit.xml` est inférieure à 60 %, voir excl. `app/Http/Controllers/Api/Mobile`) ; extension **PCOV** (voir `setup-php`, `extensions: … pcov`, `coverage: pcov`).
2. **Frontend** (`react-frontend`) — `npm ci` puis `npm run test:coverage` (Vitest + `@vitest/coverage-v8`).
3. **Build React** — `npm ci` puis `npm run build`.

## Prérequis locaux

### API Laravel

- PHP 8.3 avec **PCOV** ou **Xdebug** en mode couverture.
- Sinon : `php artisan test` fonctionne, mais `php artisan test --coverage` affichera une erreur « Code coverage driver not available ».

Avec PCOV installé :

```bash
cd laravel-api
php artisan test --coverage
```

**DT-4 (BDC-63)** : le job impose `--min=60` sur le code inclus dans `phpunit.xml`. Les tests `ApiRouteSmokeTest` couvrent un grand nombre d’endpoints en lecture côté lab. Le dossier `Api/Mobile` est exclu du calcul tant qu’il n’a pas de feature tests ciblés.

### Frontend React

```bash
cd react-frontend
npm ci
npm run test          # Vitest sans rapport de couverture
npm run test:coverage # Vitest + v8, seuils (lignes/…/fonctions) sur les pages ciblées — Voir BDC-41 : `functions` volontairement bas sur les gros écrans CRM
npm run build
```

## Dépendances npm sensibles

- **`recharts-scale`** : le tarball `0.4.5` npm peut être incomplet ; le `package.json` du frontend impose un **`overrides`** vers **`0.4.4`**. En cas d’erreur Rollup du type `Could not resolve "./util/…"` depuis `recharts-scale`, supprimer `node_modules` et relancer `npm ci`.
