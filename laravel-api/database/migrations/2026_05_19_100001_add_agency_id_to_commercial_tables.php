<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration 2 — Ajout de agency_id sur les tables commerciales
 *
 * Tables déjà traitées dans 2026_04_19_120000_agencies_tenant_and_user_links :
 *  - sites, orders, invoices, quotes
 *
 * Tables manquantes traitées ici (avec guard hasColumn) :
 *  - users, clients, dossiers, bons_commande, bons_livraison, expense_reports
 *
 * Note : "factures" correspond à la table `invoices` qui possède déjà agency_id.
 */
return new class extends Migration
{
    /**
     * Liste des tables à enrichir avec agency_id.
     * Les tables sites/orders/invoices/quotes sont déjà gérées.
     */
    private array $tables = [
        'users',
        'clients',
        'dossiers',
        'bons_commande',
        'bons_livraison',
        'expense_reports',
    ];

    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }
            if (! Schema::hasColumn($tableName, 'agency_id')) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    $table->unsignedBigInteger('agency_id')->nullable()->after('id');
                    $table->foreign('agency_id')
                        ->references('id')
                        ->on('agencies')
                        ->nullOnDelete();
                });
            }
        }
    }

    public function down(): void
    {
        foreach (array_reverse($this->tables) as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }
            if (Schema::hasColumn($tableName, 'agency_id')) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    // Supprimer la contrainte FK avant la colonne
                    $table->dropForeign([$tableName . '_agency_id_foreign']);
                    $table->dropColumn('agency_id');
                });
            }
        }
    }
};
