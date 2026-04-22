# s2gBot — Roadmap d'améliorations pour Cursor

> **Instructions pour l'agent Cursor** — Ce document liste les tâches à exécuter **une par une**, dans l'ordre. Pour chaque tâche : contexte, fichiers concernés, étapes d'implémentation, critères d'acceptation, tests à écrire. Ne pas enchaîner plusieurs tâches dans un même commit. Créer une branche `feat/s2gbot-<numéro>-<slug>` par tâche, un commit par étape, un PR par tâche.

**Stack rappel** : Laravel 11 (`laravel-api/`), React 18 + Vite (`react-frontend/`), Expo (`apps/lab-btp-mobile/`), MySQL/PostgreSQL/SQLite, Sanctum, Docker (MySQL + PHP-FPM + Nginx), déploiement GitHub Actions → SSH port 167.

**Convention de travail**
- Migrations : `php artisan make:migration`, naming `YYYY_MM_DD_hhmmss_<verbe>_<table>.php`.
- Tests backend : Pest/PHPUnit dans `laravel-api/tests/Feature/`.
- Tests frontend : Vitest + Testing Library dans `react-frontend/src/__tests__/`.
- Aucun secret en dur. Toute configuration via `.env` ou `module_settings`.
- Respecter les rôles existants (`lab_admin`, `lab_technician`, `client`, `site_contact`).

---

## Lot 1 — Quick wins (0–3 mois)

### Tâche 1 — Index composite sur `invoices` et `orders`

**Contexte.** Les dashboards (CRM / overview client) filtrent sur `client_id + status`. Sans index composite, scan complet sur volume > 10k.

**Fichiers.**
- `laravel-api/database/migrations/2026_04_21_100000_add_composite_indexes_orders_invoices.php` (nouveau)

**Étapes.**
1. Créer la migration :
   ```php
   Schema::table('invoices', fn($t) => $t->index(['client_id', 'status'], 'invoices_client_status_idx'));
   Schema::table('orders',   fn($t) => $t->index(['client_id', 'status'], 'orders_client_status_idx'));
   Schema::table('invoices', fn($t) => $t->index(['status', 'due_date'], 'invoices_status_due_idx'));
   ```
2. Ajouter le `down()` symétrique.
3. Exécuter `php artisan migrate` en local (SQLite/MySQL).
4. Benchmarker avec `EXPLAIN` sur `SELECT ... FROM invoices WHERE client_id = X AND status != 'paid'`.

**Critères d'acceptation.**
- Migration réversible.
- `EXPLAIN` confirme l'usage de l'index sur MySQL/PostgreSQL.
- Aucune régression sur les tests existants.

**Tests.** `php artisan migrate:fresh --seed && php artisan test`.

---

### Tâche 2 — Endpoint `/api/invoices/unpaid` + filtre multi-statuts

**Contexte.** Le frontend mobile et le CRM dérivent actuellement les impayés côté client. Endpoint dédié = moins de requêtes, plus lisible.

**Fichiers.**
- `laravel-api/app/Http/Controllers/Api/InvoiceController.php` (modifier)
- `laravel-api/routes/api.php` (ajouter route)
- `laravel-api/tests/Feature/InvoiceUnpaidTest.php` (nouveau)
- `react-frontend/src/api/invoices.ts` (ajouter `fetchUnpaidInvoices`)

**Étapes.**
1. Dans `routes/api.php` :
   ```php
   Route::get('/invoices/unpaid', [InvoiceController::class, 'unpaid']);
   ```
2. Dans `InvoiceController` ajouter méthode `unpaid(Request $r)` :
   - Statuts exclus : `draft`, `paid`.
   - Statuts inclus : `validated`, `signed`, `sent`, `relanced`.
   - Support query `?status=sent,relanced` (CSV) pour override.
   - Scope client : appliquer filtre `client_id` selon rôle (`isLab()` → toutes, sinon `auth()->user()->client_id`).
   - Retourner pagination Laravel + champ calculé `total_amount_due_ttc`.
3. Ajouter `GET /invoices?status[]=sent&status[]=relanced` (accept array).
4. Test feature couvrant : lab_admin voit tout, client voit que ses factures, filtre multi, total correct.

**Critères d'acceptation.**
- Endpoint répond 200 et paginé.
- Total dû = somme `amount_ttc` filtrée.
- 403 si user non authentifié.

---

### Tâche 3 — URLs signées pour PDF téléchargeable par le client

**Contexte.** Actuellement `POST /pdf/generate` est réservé `isLab()` → les clients ne peuvent pas télécharger leur facture en PDF (bloquant portail client).

**Fichiers.**
- `laravel-api/app/Http/Controllers/Api/PdfController.php`
- `laravel-api/app/Http/Controllers/Api/InvoiceController.php` (ajouter `pdfLink`)
- `laravel-api/routes/api.php`
- `react-frontend/src/pages/ClientInvoicesPage.tsx`

**Étapes.**
1. Créer route signée Laravel :
   ```php
   Route::get('/invoices/{invoice}/pdf', [InvoiceController::class, 'pdf'])
       ->name('invoice.pdf.signed')
       ->middleware('signed');
   ```
2. Méthode `pdfLink(Invoice $invoice)` retourne `URL::temporarySignedRoute('invoice.pdf.signed', now()->addMinutes(15), ['invoice' => $invoice->id])`.
3. Vérifier autorisation : client autorisé uniquement sur ses propres factures (`$invoice->client_id === auth()->user()->client_id`).
4. Côté React : bouton "Télécharger PDF" appelle `GET /api/invoices/{id}/pdf-link`, ouvre l'URL retournée dans nouvel onglet.
5. Appliquer la même logique pour `reports` (rapports d'essais).

**Critères d'acceptation.**
- Client télécharge uniquement ses propres PDFs.
- URL expire sous 15 min.
- Lab continue d'utiliser `/pdf/generate` comme avant.

---

### Tâche 4 — Relances automatiques factures (job scheduler)

**Contexte.** Le statut `relanced` existe mais n'est jamais déclenché. Objectif : job quotidien qui passe les factures en retard au statut `relanced` et envoie un mail template.

**Fichiers.**
- `laravel-api/app/Console/Commands/RelaunchOverdueInvoices.php` (nouveau)
- `laravel-api/app/Console/Kernel.php` (ajouter schedule)
- `laravel-api/database/migrations/2026_04_21_110000_add_reminder_fields_to_invoices.php` (nouveau)
- `laravel-api/database/seeders/MailTemplateSeeder.php` (ajouter template `invoice_reminder`)

**Étapes.**
1. Migration : ajouter `last_reminder_sent_at` timestamp nullable et `reminder_count` int default 0 sur `invoices`.
2. Commande artisan `invoices:relaunch-overdue` :
   - Sélectionne factures `status ∈ [sent, validated, signed]` avec `due_date < now()` et (`last_reminder_sent_at IS NULL` OR > 7 jours).
   - Passe au statut `relanced` (ou reste `relanced` + incrémente compteur).
   - Envoie mail via `MailTemplate` `invoice_reminder` (à créer).
   - Met à jour `last_reminder_sent_at` et `reminder_count`.
3. `Kernel.php` : `$schedule->command('invoices:relaunch-overdue')->dailyAt('08:00')`.
4. Configurer via `module_settings` clé `invoice_reminders` (délai jours, limite max, actif oui/non).

**Critères d'acceptation.**
- Commande idempotente (re-run sans doublon).
- Log dans `mail_logs`.
- Activation/désactivation via `module_settings` sans redéploiement.

**Tests.** Créer facture en retard → exécuter commande → vérifier statut + mail log.

---

### Tâche 5 — Exports comptables (CSV Sage / CEGID)

**Contexte.** Client demande export comptable pour intégrer dans Sage/CEGID (ERP existants).

**Fichiers.**
- `laravel-api/app/Http/Controllers/Api/AccountingExportController.php` (nouveau)
- `laravel-api/app/Services/AccountingExporter/SageExporter.php`
- `laravel-api/app/Services/AccountingExporter/CegidExporter.php`
- `laravel-api/routes/api.php`

**Étapes.**
1. Endpoint `GET /api/accounting/exports?format=sage|cegid&from=YYYY-MM-DD&to=YYYY-MM-DD`.
2. Exporter CSV avec colonnes Sage : `Journal, Date, N° compte, Libellé, Débit, Crédit, N° pièce` (PNM).
3. Exporter CSV CEGID : format écriture (en-tête + lignes).
4. Mapping par défaut via `module_settings` clé `accounting_export` (compte client 411, compte TVA 44571, compte vente 701, etc.).
5. Réservé `lab_admin`.

**Critères d'acceptation.**
- CSV valide et importable dans Sage/CEGID (vérifier avec échantillon client).
- Export filtrable par période.
- Totaux Débit/Crédit équilibrés.

---

### Tâche 6 — Versioning des rapports (historique `form_data`)

**Contexte.** ISO 17025 exige traçabilité des modifications de rapports signés.

**Fichiers.**
- `laravel-api/database/migrations/2026_04_21_120000_create_report_versions_table.php`
- `laravel-api/app/Models/ReportVersion.php`
- `laravel-api/app/Observers/ReportObserver.php`
- `laravel-api/app/Providers/AppServiceProvider.php` (enregistrer observer)

**Étapes.**
1. Table `report_versions` : `report_id`, `version_number`, `form_data` (JSON), `file_path` (snapshot PDF), `changed_by`, `change_reason`, `created_at`.
2. Observer `ReportObserver::updating()` : si `form_data` ou `review_status` change → créer snapshot dans `report_versions`.
3. Endpoint `GET /api/reports/{id}/versions` (lab only).
4. Bloquer modification si rapport `signed` → obliger création d'une version révisée (nouveau statut `superseded` pour l'ancien).

**Critères d'acceptation.**
- Chaque update d'un rapport signé crée un snapshot.
- Historique visible dans l'UI (timeline).

---

### Tâche 7 — Tests automatisés (coverage min 60 %)

**Contexte.** Pas de CI de tests actuellement → régressions silencieuses.

**Fichiers.**
- `laravel-api/tests/Feature/*.php` (compléter)
- `.github/workflows/tests.yml` (nouveau)
- `react-frontend/vitest.config.ts` (nouveau)
- `react-frontend/src/__tests__/` (tests composants)

**Étapes.**
1. Backend : au minimum 1 test feature par controller (`ClientController`, `OrderController`, `InvoiceController`, `QuoteController`, `ReportController`, `AuthController`, `AttachmentController`, `MobileDossierController`).
2. Frontend : Vitest + Testing Library, tests sur les 10 pages clés (CRM overview, liste invoices, form order, etc.).
3. Workflow GitHub Actions : exécuter les tests sur chaque PR.
4. Bloquer merge si tests rouges (branch protection).

**Critères d'acceptation.**
- Coverage backend ≥ 60 %, frontend ≥ 50 %.
- CI verte requise sur `main`.

---

### Tâche 8 — Archivage `activity_logs` (partition ou table annexe)

**Contexte.** `activity_logs` croît sans limite → impact perf `SELECT *`.

**Fichiers.**
- `laravel-api/app/Console/Commands/ArchiveActivityLogs.php`
- `laravel-api/database/migrations/2026_04_21_130000_create_activity_logs_archive.php`

**Étapes.**
1. Table `activity_logs_archive` miroir.
2. Commande `logs:archive --older-than=90` : déplace lignes > 90 jours vers l'archive.
3. Schedule hebdomadaire dimanche 03:00.
4. Rétention archive : 2 ans puis suppression (autre commande).

**Critères d'acceptation.**
- Volume `activity_logs` stable.
- Recherche audit trail continue à fonctionner (UNION si besoin).

---

## Lot 2 — Industrialisation (3–9 mois)

### Tâche 9 — Module équipements & étalonnages

**Contexte.** Accréditation SNIMA / ISO 17025 impossible sans gestion étalonnages.

**Fichiers.**
- `laravel-api/database/migrations/<date>_create_equipments_and_calibrations.php`
- `laravel-api/app/Models/Equipment.php`, `Calibration.php`
- `laravel-api/app/Http/Controllers/Api/EquipmentController.php`
- `react-frontend/src/pages/admin/EquipmentsPage.tsx`

**Modèle.**
- `equipments` : `id, name, code, type, brand, model, serial_number, location, agency_id (nullable), purchase_date, status (actif/réforme/maintenance), meta JSON`.
- `calibrations` : `id, equipment_id, calibration_date, next_due_date, certificate_path, provider, result, notes`.
- Pivot `equipment_test_type` : quels essais utilisent quel équipement.

**Fonctionnalités.**
- Alertes échéance étalonnage (mail + badge UI) via scheduler.
- Attachement certificat (attachment polymorphe existant).
- Lier `test_result` à `equipment_id` (nouvelle colonne optionnelle).
- Rapport PDF inclut référence équipement + date étalonnage.

**Critères d'acceptation.**
- Dashboard équipements avec filtres (expirés / à renouveler / OK).
- Export Excel liste équipements.
- Test feature : création équipement + étalonnage + alerte mail.

---

### Tâche 10 — Non-conformités & actions correctives (CAPA)

**Modèle.**
- `non_conformities` : `id, reference, detected_at, detected_by, sample_id (nullable), equipment_id (nullable), order_id (nullable), severity (minor/major/critical), description, status (open/analyzing/action/closed)`.
- `corrective_actions` : `id, non_conformity_id, title, responsible_user_id, due_date, status, verification_notes`.

**Workflow 8D.**
1. Détection → 2. Équipe → 3. Description → 4. Causes → 5. Actions → 6. Implémentation → 7. Prévention → 8. Clôture.

**Fichiers clés.**
- Controllers + pages React (liste, détail, workflow).
- Notifications mail sur changement statut.

**Critères d'acceptation.**
- KPIs non-conformités dashboard (nombre ouvert, temps moyen résolution).
- Lien optionnel vers échantillon/équipement/commande.

---

### Tâche 11 — Planning techniciens (drag & drop)

**Modèle.**
- `schedule_entries` : `id, user_id, test_type_id (nullable), order_id (nullable), sample_id (nullable), start_at, end_at, status, notes`.

**UI.**
- Calendar React (FullCalendar ou similaire), vue semaine + jour.
- Drag & drop échantillons en attente vers créneaux.
- Filtres par technicien + équipement.

**Critères d'acceptation.**
- Conflits horaires détectés.
- Notifications push mobile au technicien (optionnel V2).

---

### Tâche 12 — Bilingue FR / AR

**Outils.**
- Backend : `laravel/localization` ou `spatie/laravel-translatable` pour attributs (nom essai en FR + AR).
- Frontend : `i18next` + `react-i18next`.
- PDF : support RTL via dompdf config + font arabe (Amiri, Noto Naskh Arabic).

**Fichiers.**
- `react-frontend/src/i18n/` (fr.json, ar.json).
- `react-frontend/src/contexts/LocaleContext.tsx`.
- `laravel-api/resources/lang/fr/` + `/ar/`.
- `laravel-api/resources/views/pdf/` : support `dir="rtl"` conditionnel.

**Critères d'acceptation.**
- Switch langue dans header, persistance en localStorage.
- Rapport PDF généré en AR ou FR selon préférence client (stocké dans `clients.meta.locale`).
- Toutes les chaînes traduites (pas de texte en dur).

---

### Tâche 13 — Notifications temps réel (Laravel Reverb)

**Objectif.** Technicien terrain pushe des données → rafraîchissement live du dashboard labo.

**Fichiers.**
- `laravel-api/config/reverb.php` (configurer)
- `laravel-api/app/Events/*` (MeasureSubmittedEvent, ReportReviewedEvent, InvoicePaidEvent)
- `react-frontend/src/lib/realtime.ts` (Pusher JS connecté à Reverb)

**Critères d'acceptation.**
- Dashboard labo affiche nouveau résultat sans reload.
- Technicien voit statut revue rapport en direct.

---

### Tâche 14 — Mobile offline-first (SQLite + sync delta)

**Outils.**
- `expo-sqlite` pour stockage local.
- Queue actions pendant offline.
- Sync delta via champ `updated_at` côté API.

**Endpoints backend nécessaires.**
- `GET /api/mobile/sync?since=<timestamp>` → retourne changements par entité.
- `POST /api/mobile/sync/batch` → applique batch mutations idempotentes (réutiliser `client_submission_id` / `client_upload_id`).

**Critères d'acceptation.**
- App fonctionne sans réseau (lecture + saisie).
- Au retour online, sync automatique + résolution conflits (last-write-wins + log).

---

### Tâche 15 — Rôles fins via `access_groups.permissions`

**Contexte.** Actuellement rôles hardcodés (`lab_admin`, etc.). Permissions JSON existent mais non utilisées.

**Approche.**
- Backend : Laravel Gates `Gate::define('invoices.edit', ...)` lisant permissions JSON.
- Frontend : `<Can permission="invoices.edit">...</Can>`.

**Liste permissions cible.**
- `clients.*`, `orders.*`, `samples.*`, `reports.*`, `invoices.*`, `equipments.*`, `settings.*`.

**Critères d'acceptation.**
- Création d'un nouveau rôle sans toucher le code.
- Matrice admin rôles × permissions dans `/admin/access-groups`.

---

## Lot 3 — Différenciation (9–18 mois)

### Tâche 16 — Connecteurs instruments (CSV / RS232 / Bluetooth)

**Approche.**
- Agent local (Node ou Python, exécuté sur PC labo) qui watch un dossier CSV ou port RS232 et POST vers l'API.
- Endpoint `POST /api/instruments/readings` protégé par token instrument.
- Mapping CSV colonnes → `test_type_params`.

**Table.** `instrument_tokens` (token, equipment_id, last_seen_at).

**Critères d'acceptation.**
- Zéro double-saisie opérateur.
- Log d'audit intégré.

---

### Tâche 17 — Portail client + paiement en ligne

**Backend.**
- Integration Stripe (FR) / CMI (Maroc).
- Webhooks `payment.succeeded` → passage facture en `paid`.

**Frontend portail client (nouvel espace `/portal`).**
- Accueil : factures dues, montant total, bouton "Payer".
- Téléchargement rapports / factures (tâche 3).
- Historique commandes.

**Critères d'acceptation.**
- Paiement testé en sandbox Stripe + CMI.
- Reçu PDF automatique après paiement.

---

### Tâche 18 — BI embarqué (Metabase)

**Déploiement.** Conteneur Metabase à côté (docker-compose).

**Vues matérialisées.**
- `mv_monthly_revenue`, `mv_test_counts_by_type`, `mv_avg_delay_sample_to_report`.

**Intégration.** iFrame Metabase signé dans `/admin/analytics`.

**Critères d'acceptation.**
- 5 dashboards minimum (CA, essais, délais, qualité, équipements).
- Rafraîchissement horaire vues matérialisées.

---

### Tâche 19 — IA détection anomalies résultats

**Approche.**
- Train modèle simple (scikit-learn, Isolation Forest) sur historique `test_results` par `test_type_param`.
- Endpoint Python FastAPI déployé à côté.
- Laravel appelle le service au moment de la saisie résultat → flag "anomalie" sur l'UI.
- Pas de blocage : juste alerte + demande validation manager.

**Table.** `result_anomalies` : `test_result_id, score, model_version, reviewed_by, reviewed_at, false_positive (bool)`.

---

### Tâche 20 — OCR rapports anciens (onboarding clients Excel)

**Outils.** Tesseract ou Claude Vision API.

**Flux.**
1. Upload PDF ancien → extraction texte + tableau.
2. Mapping vers `test_types` existants (propositions + validation humaine).
3. Création auto `orders` + `samples` + `test_results` historiques.

**Critères d'acceptation.**
- Import 1 an historique d'un labo pilote en < 4 heures.

---

### Tâche 21 — Multi-tenant strict

**Approche.** Ajouter `tenant_id` sur **toutes** les tables ou créer BDD par tenant (trade-off à trancher).

**Reco.** `tenant_id` partout + global scope `TenantScope` automatique sur tous les modèles.

**Migration.** Lourde → préparer checklist (scripts de backfill, tests e2e, rollback plan).

---

### Tâche 22 — API publique OpenAPI + webhooks

**Outils.** `darkaonline/l5-swagger` ou `knuckleswtf/scribe`.

**Webhooks.**
- `invoice.paid`, `report.signed`, `order.completed`.
- Table `webhook_subscriptions` + retry exponentiel.

**Critères d'acceptation.**
- Doc Swagger publique sur `/api/docs`.
- Intégration n8n / Make testée.

---

## Dette technique transverse

### DT-1 — Supprimer `services/` (anciens microservices Node)
Vérifier aucune dépendance, archiver dans branche `legacy/services`, supprimer de `main`.

### DT-2 — Schémas JSON pour colonnes `meta`
Définir un schéma JSON par entité dans `laravel-api/app/Schemas/*.json`, valider en écriture.

### DT-3 — Migration production SQLite → PostgreSQL
Si la prod tourne en SQLite : préparer script de migration (mysqldump-style), vérifier compat JSON (`->>`), benchmarker.

### DT-4 — Enum partagé statuts (Laravel ↔ React)
Générer `react-frontend/src/types/enums.ts` depuis PHP enums via un artisan command (`php artisan generate:ts-enums`).

### DT-5 — Consolider templates PDF
Fusionner `report_pdf_templates` redondants, exploiter `layout_config` JSON pour variantes.

---

## Ordre d'exécution recommandé

| Sprint | Tâches | Durée | Focus |
|---|---|---|---|
| Sprint 1 (S17-18) | 1, 2, 3 | 2 sem | Perf + portail client (quick wins) |
| Sprint 2 (S19-20) | 4, 5 | 2 sem | Automatisation facturation + comptabilité |
| Sprint 3 (S21-22) | 6, 7, 8 | 2 sem | ISO 17025 v0 + tests |
| Sprint 4-6 (S23-28) | 9, 10, 11 | 6 sem | Équipements + qualité + planning |
| Sprint 7-9 (S29-34) | 12, 13, 14, 15 | 6 sem | i18n, temps réel, offline, RBAC |
| Sprint 10-15 (S35-46) | 16, 17, 18 | 12 sem | Instruments + portail paiement + BI |
| Sprint 16-19 (S47-54) | 19, 20, 21, 22 | 8 sem | IA, OCR, multi-tenant, API publique |

---

## Règles transverses pour Cursor

1. **Une tâche = une branche = un PR.** Pas de mix.
2. **Migrations non destructives** : toujours `down()` cohérent, pas de `dropTable` sur prod sans backup documenté.
3. **Tests obligatoires** : au minimum un test feature par tâche backend, un test composant par tâche frontend.
4. **Documentation** : mettre à jour `README.md` ou `docs/*.md` si la tâche change l'API publique ou les routes.
5. **Commits** : format conventionnel `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`.
6. **Review checklist** : sécurité (permissions rôles), perf (index, N+1), i18n (pas de FR hardcodé si tâche ≥ 12), a11y (ARIA, focus).
7. **Pas de secret en dur.** Utiliser `.env` + `module_settings` pour config runtime.
8. **Audit trail** : si la tâche modifie des entités sensibles (factures, rapports, équipements), logger dans `activity_logs`.

---

*Document généré le 20 avril 2026. Mis à jour à chaque sprint review.*
