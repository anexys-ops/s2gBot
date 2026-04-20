# CI et couverture de tests (s2gBot)

Le workflow GitHub Actions [`.github/workflows/tests.yml`](../.github/workflows/tests.yml) exécute :

1. **Laravel** (`laravel-api`) — `composer install` puis `php artisan test --coverage` avec l’extension **PCOV** (voir `setup-php`, `extensions: … pcov`, `coverage: pcov`).
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

Seuil global élevé (ex. `--min=60`) est un objectif de roadmap : il suppose une base de tests plus large que l’actuelle sur tout le dossier `app/` (voir `phpunit.xml`, balise `<source>`).

### Frontend React

```bash
cd react-frontend
npm ci
npm run test          # Vitest sans rapport de couverture
npm run test:coverage # Vitest + v8, seuils sur les pages CRM ciblées (voir `vitest.config.ts`)
npm run build
```

## Dépendances npm sensibles

- **`recharts-scale`** : le tarball `0.4.5` npm peut être incomplet ; le `package.json` du frontend impose un **`overrides`** vers **`0.4.4`**. En cas d’erreur Rollup du type `Could not resolve "./util/…"` depuis `recharts-scale`, supprimer `node_modules` et relancer `npm ci`.
