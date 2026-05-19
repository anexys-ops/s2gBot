<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Migration 6 — Ajout de agency_code sur sequences pour numérotation par agence
 *
 * Table sequences (2026_04_28_300000_create_sequences_and_expense_reports) :
 *   id | type (unique, 16) | last_value | timestamps
 *
 * Objectif :
 *  1. Ajouter la colonne agency_code varchar(10) default 'MHD'
 *  2. Remplacer l'index unique sur (type) par un index composé (type, agency_code)
 *
 * Pas de doctrine/dbal : on utilise ALTER TABLE raw.
 * Les lignes existantes (OM, NDF, MAT, TSK) reçoivent agency_code = 'MHD'.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sequences')) {
            return;
        }

        // 1. Ajouter la colonne agency_code si absente
        if (! Schema::hasColumn('sequences', 'agency_code')) {
            Schema::table('sequences', function (Blueprint $table) {
                $table->string('agency_code', 10)->default('MHD')->after('type');
            });
        }

        $driver = Schema::getConnection()->getDriverName();

        // 2. Remplacer l'index unique (type) par (type, agency_code)
        try {
            if ($driver === 'mysql' || $driver === 'mariadb') {
                // Supprimer l'ancien index unique sur type
                $indexes = DB::select("SHOW INDEX FROM sequences WHERE Key_name = 'sequences_type_unique'");
                if (! empty($indexes)) {
                    DB::statement('ALTER TABLE sequences DROP INDEX sequences_type_unique');
                }
                // Créer le nouvel index unique composé (type, agency_code)
                $compositeExists = DB::select("SHOW INDEX FROM sequences WHERE Key_name = 'sequences_type_agency_code_unique'");
                if (empty($compositeExists)) {
                    DB::statement('ALTER TABLE sequences ADD UNIQUE KEY sequences_type_agency_code_unique (type, agency_code)');
                }
            } elseif ($driver === 'pgsql') {
                // Supprimer l'ancien index unique
                $indexes = DB::select("SELECT indexname FROM pg_indexes WHERE tablename = 'sequences' AND indexname = 'sequences_type_unique'");
                if (! empty($indexes)) {
                    DB::statement('DROP INDEX sequences_type_unique');
                }
                // Créer le nouvel index unique composé
                $compositeExists = DB::select("SELECT indexname FROM pg_indexes WHERE tablename = 'sequences' AND indexname = 'sequences_type_agency_code_unique'");
                if (empty($compositeExists)) {
                    DB::statement('CREATE UNIQUE INDEX sequences_type_agency_code_unique ON sequences (type, agency_code)');
                }
            }
            // sqlite : tolérée sans modification d'index
        } catch (\Throwable $e) {
            // Ne pas bloquer si la modification d'index échoue
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('sequences')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        // Rétablir l'index unique simple sur type
        try {
            if ($driver === 'mysql' || $driver === 'mariadb') {
                $compositeExists = DB::select("SHOW INDEX FROM sequences WHERE Key_name = 'sequences_type_agency_code_unique'");
                if (! empty($compositeExists)) {
                    DB::statement('ALTER TABLE sequences DROP INDEX sequences_type_agency_code_unique');
                }
                $simpleExists = DB::select("SHOW INDEX FROM sequences WHERE Key_name = 'sequences_type_unique'");
                if (empty($simpleExists)) {
                    DB::statement('ALTER TABLE sequences ADD UNIQUE KEY sequences_type_unique (type)');
                }
            } elseif ($driver === 'pgsql') {
                $compositeExists = DB::select("SELECT indexname FROM pg_indexes WHERE tablename = 'sequences' AND indexname = 'sequences_type_agency_code_unique'");
                if (! empty($compositeExists)) {
                    DB::statement('DROP INDEX sequences_type_agency_code_unique');
                }
                $simpleExists = DB::select("SELECT indexname FROM pg_indexes WHERE tablename = 'sequences' AND indexname = 'sequences_type_unique'");
                if (empty($simpleExists)) {
                    DB::statement('CREATE UNIQUE INDEX sequences_type_unique ON sequences (type)');
                }
            }
        } catch (\Throwable $e) {}

        if (Schema::hasColumn('sequences', 'agency_code')) {
            Schema::table('sequences', function (Blueprint $table) {
                $table->dropColumn('agency_code');
            });
        }
    }
};
