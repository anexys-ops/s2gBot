# Livraison — Lot roadmap s2gBot (tâches 4 à 8 + socle CI)

**Date de génération :** 2026-04-20  
**Branche de travail :** à partir de `feat/s2gbot-lot1-indexes-invoices-pdf` (tâches 1–3 déjà livrées) ; extension avec tâches 4–8.

---

## Synthèse exécutive

| Zone | Statut | Commentaire |
|------|--------|-------------|
| Tâche 4 — Relances factures | Livré | Commande artisan, planification, `module_settings`, mail template, champs facture, tests |
| Tâche 5 — Export comptable | Livré | Endpoint `lab_admin`, CSV Sage / Cegid, comptes via `module_settings` |
| Tâche 6 — Versioning rapports | Livré | Table `report_versions`, observer, API versions lab, blocage `form_data` si signé |
| Tâche 7 — CI tests | Partiel | Workflow GitHub : tests Laravel + build React ; **pas** de Vitest ni seuil de couverture |
| Tâche 8 — Archivage logs | Livré | Table archive, commande `logs:archive`, purge `logs:purge-archive`, planification archive |

---

## Détail par tâche

### Tâche 4 — Relances automatiques (`invoices:relaunch-overdue`)

- **Fichiers clés :** `app/Console/Commands/RelaunchOverdueInvoices.php`, `routes/console.php` (schedule 08:00), migration `2026_04_21_140000_add_reminder_fields_to_invoices.php`, seed `invoice_reminders` dans `2026_04_21_143000_seed_invoice_reminders_and_accounting_module_settings.php`, `MailTemplateSeeder` (`invoice_reminder`), modèle `Invoice`.
- **Comportement :** factures en retard (`due_date` &lt; aujourd’hui), statuts `validated`, `signed`, `sent`, `relanced`, respect de `min_days_between`, plafond `max_reminders_per_invoice`, activation `enabled` dans `module_settings.invoice_reminders`. Si le client n’a **pas** d’e-mail, relance **reportée** (pas d’incrément compteur / date — pour réessayer après correction).
- **Test :** `tests/Feature/InvoiceRelaunchCommandTest.php`.

### Tâche 5 — Exports comptables

- **Fichiers clés :** `app/Http/Controllers/Api/AccountingExportController.php`, `app/Services/AccountingExporter/SageExporter.php`, `CegidExporter.php`, route `GET /api/accounting/exports`, clé `accounting_export` dans `module_settings`.
- **Sécurité :** réservé **`lab_admin`** (pas technicien).
- **Test :** `tests/Feature/AccountingExportTest.php`.

### Tâche 6 — Versioning rapports

- **Fichiers clés :** migration `2026_04_21_141000_create_report_versions_table.php`, `ReportVersion`, `ReportObserver`, enregistrement dans `AppServiceProvider`, `GET /api/reports/{report}/versions` (lab + accès commande).
- **Règle métier :** si `signed_at` est renseigné, toute modification de `form_data` lève une `ValidationException`. Snapshot des versions lors des changements de `form_data` ou `review_status`.
- **Tests :** `tests/Feature/ReportVersionsTest.php`.
- **Non livré (hors périmètre) :** timeline UI, statut `superseded` sur l’ancien rapport, création guidée d’une « révision » métier.

### Tâche 7 — Tests automatisés / CI

- **Livré :** `.github/workflows/tests.yml` — job PHP (`php artisan test`) et job `npm ci` + `npm run build` sur `react-frontend`.
- **Non livré :** Vitest, Testing Library, seuils de couverture 60 % / 50 %, tests par contrôleur côté front.

### Tâche 8 — Archivage `activity_logs`

- **Fichiers clés :** migration `2026_04_21_142000_create_activity_logs_archive_table.php`, commandes `logs:archive`, `logs:purge-archive`, schedule hebdomadaire dimanche 03:00 pour l’archive.
- **Test :** `tests/Feature/ActivityLogArchiveTest.php`.
- **Non livré :** lecture unifiée audit (`ActivityLogController` + `UNION` archive) ; planification automatique de `logs:purge-archive` (commande manuelle ou à ajouter au scheduler selon politique de rétention).

---

## Revue technique (auto-contrôle)

1. **Sécurité :** exports compta et versions rapports bien limités aux rôles prévus ; relances système sans `user_id` dans `mail_logs` (comportement cohérent avec envois automatiques).
2. **Idempotence relances :** fenêtre `min_days_between` + plafond `reminder_count` ; absence d’e-mail = pas de « succès » métier sur la facture (évite de bloquer indéfiniment sans action corrective).
3. **Observer rapports :** une ligne de version par mise à jour qui touche `form_data` ou `review_status` — à surveiller si des mises à jour techniques massives sont ajoutées plus tard.
4. **Exports CSV :** formats **génériques** ; validation comptable réelle (Sage / Cegid) indispensable avant production financière.

---

## Journal — validation externe (Claude / relecture humaine)

*Consigne : après chaque relecture, ajouter une entrée datée en bas. L’agent principal relira ce fichier et appliquera les corrections listées.*

| Date | Validateur | Verdict | Points à corriger / suivis |
|------|------------|---------|----------------------------|
| 2026-04-20 | Agent Cursor (auto-revue) | Partiel — prêt pour relecture | CI : vérifier que `Tests` est requis en branch protection ; exports CSV à valider avec un comptable ; pas d’UI timeline versions ; pas d’UNION audit sur archive ; Vitest non ajouté. |
| _à remplir_ | Claude / autre relecteur | _OK / À corriger_ | _Coller ici les retours ; l’agent mettra à jour le code puis une nouvelle ligne._ |

---

## Suite recommandée (backlog)

- Tâches 9+ (équipements, CAPA, planning, i18n, Reverb, etc.) selon `docs/s2gbot-cursor-roadmap.md` et document source complet si conservé ailleurs.
- Branch protection GitHub : exiger le workflow `Tests` vert avant merge sur `main`.
- Couverture : introduire Pest coverage + Vitest quand le socle npm est stabilisé.

---

## Commandes de vérification locale

```bash
cd laravel-api && php artisan test
cd laravel-api && php artisan invoices:relaunch-overdue --dry-run
cd laravel-api && php artisan logs:archive --older-than=90
cd react-frontend && npm run build
```

---

*Fin du document livraison — mise à jour manuelle ou par agent lors des validations externes.*
