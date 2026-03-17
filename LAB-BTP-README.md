# Plateforme essais laboratoire BTP (Laravel + React)

Application de gestion des essais de laboratoire BTP : commandes, échantillons, résultats, rapports PDF et facturation.

## Structure

- **laravel-api/** — API REST Laravel 11 (Sanctum, MySQL/PostgreSQL)
- **react-frontend/** — Interface React 18 (Vite, React Router, React Query)

## Prérequis

- PHP 8.2+, Composer
- Node.js 18+, npm ou pnpm
- MySQL 8 ou PostgreSQL 15

## Relance et seed

Pour **voir les modifications** et **injecter le seed** en une fois :

```bash
# Migrations + seed (nécessite PHP et composer install dans laravel-api)
./scripts/seed-btp.sh
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

Frontend : http://localhost:5173

Configurer le proxy dans `vite.config.ts` si l’API n’est pas sur le même hôte (target: `http://localhost:8000`).

## Comptes de démo (après seed)

| Rôle            | Email            | Mot de passe |
|-----------------|------------------|--------------|
| Admin lab       | admin@lab.local  | password     |
| Technicien      | tech@lab.local   | password     |
| Client          | client@demo.local| password     |

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
