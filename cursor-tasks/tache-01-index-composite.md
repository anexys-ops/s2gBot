# Tâche 01 — Index composite `(client_id, status)` sur `invoices` et `orders`

> **Copier-coller ce bloc entier dans Cursor.** Projet : `s2gBot` (Laravel 11 + React 18 + Expo). Travaille uniquement dans `laravel-api/`.

---

## Contexte

Les dashboards CRM (page `/crm/clients/{id}`, appel `GET /api/clients/{id}/commercial-overview`) filtrent les factures et commandes par `client_id + status`. Sur un labo avec 10k+ factures, le scan complet dégrade les temps de réponse au-delà de 2 secondes. Objectif : ajouter des index composites pour ramener le temps de réponse sous 300 ms.

Les factures sont filtrées sur les statuts : `draft`, `validated`, `signed`, `sent`, `relanced`, `paid`. Les commandes sur `draft`, `in_progress`, `completed`, etc. Le calcul du montant dû côté controller (`ClientCommercialController@overview`) exclut `paid` et `draft`, donc le filtre est souvent `WHERE client_id = ? AND status NOT IN (...)`.

---

## Objectif

Créer **une seule migration** Laravel ajoutant trois index composites :

1. `invoices_client_status_idx` sur `invoices (client_id, status)` — pour le filtre overview.
2. `orders_client_status_idx` sur `orders (client_id, status)` — pour les listings commandes par client.
3. `invoices_status_due_idx` sur `invoices (status, due_date)` — pour le futur job de relances (tâche 04).

Migration **entièrement réversible** (`down()` qui drop les 3 index par nom).

---

## Fichiers à créer / modifier

- **Créer** : `laravel-api/database/migrations/2026_04_21_100000_add_composite_indexes_orders_invoices.php`
- **Modifier** : aucun autre fichier.

---

## Spécification exacte

### Fichier `2026_04_21_100000_add_composite_indexes_orders_invoices.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->index(['client_id', 'status'], 'invoices_client_status_idx');
            $table->index(['status', 'due_date'], 'invoices_status_due_idx');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->index(['client_id', 'status'], 'orders_client_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('invoices_client_status_idx');
            $table->dropIndex('invoices_status_due_idx');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_client_status_idx');
        });
    }
};
```

---

## Étapes d'implémentation (suivre l'ordre)

1. Créer une branche : `git checkout -b feat/s2gbot-01-composite-indexes`.
2. Créer le fichier de migration ci-dessus avec le contenu exact.
3. Exécuter localement :
   ```bash
   cd laravel-api
   php artisan migrate
   php artisan migrate:rollback --step=1
   php artisan migrate
   ```
   Les 3 commandes doivent passer sans erreur (up, down, up).
4. Vérifier sur MySQL que les index existent :
   ```bash
   php artisan tinker --execute="DB::select('SHOW INDEX FROM invoices');"
   ```
   Attendu : 3 index nommés présents (`invoices_client_status_idx`, `invoices_status_due_idx`, l'existant PRIMARY).
5. Sur SQLite (test local par défaut), vérifier :
   ```bash
   php artisan tinker --execute="print_r(DB::select(\"SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='invoices'\"));"
   ```
6. Lancer la suite de tests existante : `php artisan test` — aucun test ne doit régresser.
7. Commit : `git commit -m "feat(db): add composite indexes on invoices and orders for CRM dashboard perf"`.
8. Push + créer PR vers `main` avec le titre : `feat(db): composite indexes invoices/orders (task 01)`.

---

## Critères d'acceptation (checklist)

- [ ] Migration unique créée au bon chemin, nom exact.
- [ ] `php artisan migrate` passe sans erreur sur MySQL **et** SQLite.
- [ ] `php artisan migrate:rollback --step=1` puis re-`migrate` re-passent sans erreur (idempotence).
- [ ] Les trois index sont visibles dans le schéma.
- [ ] `php artisan test` continue à passer à 100 % (aucune régression).
- [ ] Commit unique, message conventionnel.
- [ ] Aucune autre modification de fichier dans ce PR.

---

## Retour attendu (à me coller ensuite)

Colle dans la conversation :

1. Le **diff** complet du fichier créé (ou le lien PR GitHub).
2. La **sortie** de `php artisan migrate` et `php artisan migrate:rollback` (texte console).
3. La **sortie** de `php artisan test` (dernières lignes : nombre de tests passés/échoués).
4. La sortie de `SHOW INDEX FROM invoices` ou équivalent SQLite prouvant que les index sont créés.

Je fais la revue, j'ajoute les corrections si besoin, puis on passe à la tâche 02.

---

**Ne traite pas d'autres tâches. Ne modifie aucun autre fichier. Ne refactor rien. Juste cette migration.**
