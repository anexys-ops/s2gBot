# Plateforme essais laboratoire BTP (Laravel + React)

Application de gestion des essais de laboratoire BTP : commandes, échantillons, résultats, rapports PDF et facturation.

**Une seule interface web** (`react-frontend/`) avec deux espaces : **CRM** (`/crm`) et **Terrain & laboratoire** (`/terrain`) — ouvrables en parallèle dans deux onglets.

## Structure

- **laravel-api/** — API REST Laravel 11 (Sanctum, MySQL/PostgreSQL)
- **react-frontend/** — Interface React 18 unique (Vite, React Router, React Query)

Pour comparer cette approche avec un **module Dolibarr** (ERP + labo) : [docs/DOLIBARR-VS-PLATEFORME-BTP.md](docs/DOLIBARR-VS-PLATEFORME-BTP.md).

## Prérequis

- Node.js 18+ (déjà là si tu as lancé `./install-env.sh`)
- Pour le backend BTP : PHP 8.2+ et Composer (voir ci‑dessous), ou Docker
- Base de données : MySQL/PostgreSQL **ou** SQLite (aucune install pour SQLite)

## Démarrage rapide (Mac sans PHP ni MySQL)

Si **php**, **brew** et **composer** ne sont pas reconnus dans le Terminal :

**1. Installer PHP et Composer (une fois)**  
Dans le Terminal, à la racine du projet :

```bash
cd /Users/admin/Documents/s2gBot
chmod +x scripts/install-php-mac.sh
./scripts/install-php-mac.sh
```

Le script installe Homebrew si besoin, puis PHP et Composer. Tu peux avoir à entrer ton mot de passe Mac.

**2. Tout configurer avec SQLite (sans MySQL)**  
Dans le **même** terminal, après l’étape 1 :

```bash
chmod +x scripts/setup-btp-sqlite.sh
./scripts/setup-btp-sqlite.sh
```

Cela crée la base SQLite, installe les dépendances Laravel, lance les migrations et le seed.

**3. Lancer l’appli**

```bash
./start-btp.sh
```

Puis ouvre http://localhost:5173 et connecte-toi avec **admin@lab.local** / **password**.

---

## Relance et seed (déjà configuré)

Une fois PHP et la base en place :

```bash
# Avec PHP en local
./scripts/seed-btp.sh

# Ou avec Docker
./scripts/seed-btp-docker.sh
```

Pour lancer la plateforme BTP (Laravel + React) puis seed si possible :

```bash
./start-btp.sh
```

### Backend (Laravel)

```bash
cd laravel-api
cp .env.example .env
# Éditer .env : DB_*, FRONTEND_URL=http://localhost:5173, APP_KEY
composer install
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan storage:link
php artisan serve
```

API : http://localhost:8000

### Frontend (React)

```bash
cd react-frontend
npm install
npm run dev
```

Frontend : http://localhost:5173 (ou 5174 si 5173 est pris). Si la page ne s'affiche pas : essayez **http://127.0.0.1:5174** dans un navigateur ; en remote, utilisez l'IP affichée par Vite.

Configurer le proxy dans `vite.config.ts` si l’API n’est pas sur le même hôte (target: `http://localhost:8000`).

## Comptes de démo (après seed)

| Rôle            | Email            | Mot de passe |
|-----------------|------------------|--------------|
| Admin lab       | admin@lab.local  | password     |
| Technicien      | tech@lab.local   | password     |
| Client          | client@demo.local| password     |
| Contact chantier (ZAC démo) | chantier@demo.local | password |

Après `php artisan db:seed`, le seeder **DemoFullDatasetSeeder** ajoute (une seule fois) des exemples : clients BTP supplémentaires, chantiers avec **GPS**, adresses de facturation, **mission** `MIS-SEED-ZAC-01` avec forages **SC1 / P1**, couches géologiques, **commandes** (`SEED-CHANT-ZAC-01`, `SEED-RAPPORT-REVIEW`, `SEED-FACTURE-LIE`), **échantillons** liés aux forages et un **résultat d’essai**, **rapport** en `pending_review`, **devis** `DEV-SEED-2026-001` / brouillon `DEV-SEED-2026-002`, **facture** `FAC-SEED-2026-001` liée à la commande facture, fiche **cadrage** labo si la table était vide. Référence chantier pivot : `SEED-DEMO-ZAC-IRIS`.

Le seeder **DemoMarocExamplesSeeder** ajoute ensuite (une fois) le client **Atlas BTP & Projets (MA)**, deux **chantiers Casablanca** avec coordonnées GPS (`SEED-CASA-PORT-ANFA`, `SEED-CASA-GREEN-BC`), **missions + forages** géolocalisés, un **devis** `DEV-SEED-MA-PORT-354K` à **5 lignes** et une **facture encaissée** `FAC-SEED-MA-354000` à **354 000 DH TTC** (295 000 DH HT, TVA 20 %), plus un second **devis** multi-lignes `DEV-SEED-MA-GREEN-BC` pour le projet résidentiel. Sur la **fiche chantier**, une **carte GPS** compacte s’affiche si lat/long sont renseignées ; l’onglet **Carte** agrège chantier + forages.

## Support

- **Site** : [apps-dev.fr](https://apps-dev.fr)
- **E-mail** : [support@anexys.fr](mailto:support@anexys.fr)
- **WhatsApp** : [+33 6 89 51 59 28](https://wa.me/33689515928)

## Rôles

- **lab_admin** — Gestion catalogue, clients, chantiers, factures, rapports
- **lab_technician** — Saisie résultats, génération rapports, réception échantillons
- **client** — Commandes (son client), consultation rapports et factures
- **site_contact** — Idem client, rattaché à un chantier

## Endpoints API (préfixe `/api`)

- `POST /login`, `POST /register`, `POST /logout`, `GET /user`
- `GET|POST|... /clients`, `/sites`, `/test-types`, `/orders`, `/samples`, `/invoices`
- `GET /orders/{id}/samples`, `POST /orders/{id}/reports`, `GET /reports/{id}/download`
- `POST /samples/{id}/results`, `POST /invoices/from-orders`

Toutes les routes (sauf login/register) nécessitent `Authorization: Bearer <token>`.

## Back-office LIMS BTP (aller vite sans se tromper)

### Cadrage (Semaine 0)

Menu **Back office → Cadrage (S0)** : checklist de cadrage pour couvrir le flux de bout en bout (demande → prélèvement → essai → résultats → rapport → facturation).

À clarifier :

- **Types d’essais au démarrage** : béton, sols, granulats, bitume, acier, autres
- **Normes / référentiels** : NF, EN, ASTM, méthodes internes
- **Périmètre** : 1 labo, multi-sites ou mobile (chantier)
- **Traçabilité (ISO 17025)** : audit trail, signatures, étalonnages

Réservé aux **lab_admin** pour modification.

### Exemples de calculs BTP

Menu **Back office → Calculs BTP** : formules courantes avec exemples et mini-calculateur.

| Calcul | Norme | Exemple |
|--------|--------|--------|
| Résistance caractéristique béton (fck) | NF EN 12390-3 | fck = moyenne − k×σ |
| Module de finesse (granulats) | NF EN 933-1 | MF = Σ(refus cumulés)/100 |
| Equivalent de sable (SE) | NF EN 933-8 | SE = (h₂/h₁)×100 |
| Indice CBR | NF EN 13286-47 | CBR = (P/P₀)×100 |
| Masse volumique apparente | NF EN 1097-3 | ρ = m/V |
| Teneur en eau W | NF EN ISO 17892-1 | W = (m_humide − m_sec)/m_sec × 100 |
| Indice de plasticité IP | NF EN ISO 17892-12 | IP = WL − WP |

API : `GET /api/btp-calculations/exemples`, `POST /api/btp-calculations/calculer` (body : `{ "id", "valeurs" }`).

### Graphiques essais

Menu **Graphiques essais** : visualisation des essais avec plusieurs onglets.

- **Résumé** : camembert (essais par type), courbe (évolution des commandes par mois), tableau des derniers résultats.
- **Béton** / **Granulats** / **Sols** : filtrage par famille d’essais, graphiques Min/Max/Moyenne par paramètre, série des dernières valeurs.
- **Tous les essais** : barres (nombre d’essais et de résultats par type), évolution par mois.

API : `GET /api/stats/essais` (données agrégées pour les graphiques).
