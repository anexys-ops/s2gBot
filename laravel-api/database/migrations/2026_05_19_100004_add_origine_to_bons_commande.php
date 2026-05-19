<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration 5 — Ajout de origine et notes_internes_odm sur bons_commande
 *
 * Colonnes ajoutées (avec guard hasColumn) :
 *  - origine             : enum('devis','interne') — source du bon de commande
 *  - notes_internes_odm  : notes de l'ingénieur pour le dispatch terrain/labo
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('bons_commande')) {
            return;
        }

        Schema::table('bons_commande', function (Blueprint $table) {
            if (! Schema::hasColumn('bons_commande', 'origine')) {
                $table->enum('origine', ['devis', 'interne'])->default('devis')->after('statut');
            }
            if (! Schema::hasColumn('bons_commande', 'notes_internes_odm')) {
                $table->text('notes_internes_odm')->nullable()->after('notes')
                    ->comment('Notes ingénieur pour dispatch ODM terrain/labo');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('bons_commande')) {
            return;
        }

        Schema::table('bons_commande', function (Blueprint $table) {
            if (Schema::hasColumn('bons_commande', 'notes_internes_odm')) {
                $table->dropColumn('notes_internes_odm');
            }
            if (Schema::hasColumn('bons_commande', 'origine')) {
                $table->dropColumn('origine');
            }
        });
    }
};
