# s2gBot — Roadmap d'améliorations pour Cursor

> **Instructions pour l'agent Cursor** — Ce document liste les tâches à exécuter **une par une**, dans l'ordre. Pour chaque tâche : contexte, fichiers concernés, étapes d'implémentation, critères d'acceptation, tests à écrire. Ne pas enchaîner plusieurs tâches dans un même commit. Créer une branche `feat/s2gbot-<numéro>-<slug>` par tâche, un commit par étape, un PR par tâche.

**Stack rappel** : Laravel 11 (`laravel-api/`), React 18 + Vite (`react-frontend/`), Expo (`apps/lab-btp-mobile/`), MySQL/PostgreSQL/SQLite, Sanctum, Docker (MySQL + PHP-FPM + Nginx), déploiement GitHub Actions → SSH port 167.

**Convention de travail**
- Migrations : `php artisan make:migration`, naming `YYYY_MM_DD_hhmmss_<verbe>_<table>.php`.
- Tests backend : Pest/PHPUnit dans `laravel-api/tests/Feature/`.
- Tests frontend : Vitest + Testing Library dans `react-frontend/src/__tests__/`.
- Aucun secret en dur. Toute configuration via `.env` ou `module_settings`.
- Respecter les rôles existants (`lab_admin`, `lab_technician`, `client`, `site_contact`).

**Note codebase (avril 2026)** : L’API React des factures vit dans `react-frontend/src/api/client.ts` (`invoicesApi`). La page liste factures (lab + client) est `react-frontend/src/pages/Invoices.tsx` (pas de fichier `ClientInvoicesPage.tsx`).

---

## Lot 1 — Quick wins (0–3 mois)

### Tâche 1 — Index composite sur `invoices` et `orders`

**Contexte.** Les dashboards (CRM / overview client) filtrent sur `client_id + status`. Sans index composite, scan complet sur volume > 10k.

**Fichiers.**
- `laravel-api/database/migrations/2026_04_21_100000_add_composite_indexes_orders_invoices.php` (nouveau)

**Étapes.**
1. Créer la migration avec index nommés et `down()` symétrique.
2. Exécuter `php artisan migrate` en local.
3. Vérifier avec `EXPLAIN` sur MySQL/PostgreSQL si disponible.

**Critères d'acceptation.**
- Migration réversible.
- Aucune régression sur les tests existants.

**Tests.** `php artisan migrate:fresh --seed && php artisan test`.

---

### Tâche 2 — Endpoint `/api/invoices/unpaid` + filtre multi-statuts

**Contexte.** Le frontend mobile et le CRM dérivent actuellement les impayés côté client. Endpoint dédié = moins de requêtes, plus lisible.

**Fichiers.**
- `laravel-api/app/Http/Controllers/Api/InvoiceController.php` (modifier)
- `laravel-api/routes/api.php` (ajouter route **avant** `apiResource('invoices')`)
- `laravel-api/tests/Feature/InvoiceUnpaidTest.php` (nouveau)
- `react-frontend/src/api/client.ts` — étendre `invoicesApi` (`listUnpaid`, `list` multi-status)

**Critères d'acceptation.**
- Endpoint répond 200 et paginé.
- Total dû = somme `amount_ttc` sur l’ensemble filtré (pas seulement la page courante).
- Invité : 401 (Sanctum) ; accès refusé à une autre entité : 403.

---

### Tâche 3 — URLs signées pour PDF téléchargeable par le client

**Fichiers.**
- `laravel-api/app/Http/Controllers/Api/PdfController.php` (méthode stream facture réutilisable)
- `laravel-api/app/Http/Controllers/Api/InvoiceController.php` (`pdfLink`, `signedPdf`)
- `laravel-api/app/Http/Controllers/Api/ReportController.php` (`pdfLink`, `signedPdf`)
- `laravel-api/routes/api.php` (routes signées hors `auth:sanctum`)
- `react-frontend/src/pages/Invoices.tsx` (bouton PDF client)
- `react-frontend/src/api/client.ts` (`reportsApi.pdfLink`, ouverture URL)

**Critères d'acceptation.**
- Client télécharge uniquement ses propres PDFs (lien émis après contrôle d’accès).
- URL expire sous 15 min.
- Lab continue d'utiliser `POST /pdf/generate` comme avant.

---

### Tâches 4 à 8 — Implémentées dans le dépôt (avril 2026)

- **4** — Relances : `invoices:relaunch-overdue`, champs `last_reminder_sent_at` / `reminder_count`, `invoice_reminders` + template `invoice_reminder`, schedule 08:00. Voir `livraison.md`.
- **5** — `GET /api/accounting/exports` (Sage / Cegid), `accounting_export` dans `module_settings`.
- **6** — `report_versions`, `ReportObserver`, `GET /api/reports/{id}/versions` (lab), blocage `form_data` si rapport signé.
- **7** — `.github/workflows/tests.yml` (Laravel + build React) ; couverture / Vitest : **non** (à faire).
- **8** — `activity_logs_archive`, `logs:archive`, `logs:purge-archive`, schedule hebdo archive.

### Tâches 9 à 22 — Backlog (non réalisées ici)

Équipements, CAPA, planning, i18n, Reverb, offline mobile, RBAC, instruments, portail paiement, Metabase, IA, OCR, multi-tenant, OpenAPI/webhooks, etc.

---

## Règles transverses pour Cursor

1. **Une tâche = une branche = un PR.** Pas de mix.
2. **Migrations non destructives** : toujours `down()` cohérent.
3. **Tests obligatoires** : au minimum un test feature par tâche backend.
4. **Pas de secret en dur.** Utiliser `.env` + `module_settings` pour config runtime.

---

*Document généré le 20 avril 2026. Mis à jour à chaque sprint review. Version enregistrée dans le dépôt : avril 2026.*
