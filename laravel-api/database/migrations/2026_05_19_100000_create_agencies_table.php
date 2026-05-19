<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Migration 1 — Table agencies
 *
 * La table agencies a été créée dans 2026_04_19_120000_agencies_tenant_and_user_links.php
 * avec les colonnes de base (client_id, name, code, is_headquarters, address, city, postal_code).
 *
 * Cette migration ajoute les colonnes métier manquantes :
 *  - phone, email, is_siege, active
 *  - rend code unique globalement (contrainte distincte de l'index composé client_id+code)
 *
 * NOTE : Le code unique global peut entrer en conflit avec l'index composé existant
 * (client_id, code). On gère cela avec un ALTER TABLE raw pour éviter doctrine/dbal.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('agencies')) {
            Schema::create('agencies', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code', 10)->unique();
                $table->string('address')->nullable();
                $table->string('city')->nullable();
                $table->string('phone', 30)->nullable();
                $table->string('email')->nullable();
                $table->boolean('is_siege')->default(false);
                $table->boolean('active')->default(true);
                $table->timestamps();
            });

            return;
        }

        // La table existe déjà — ajouter les colonnes manquantes
        Schema::table('agencies', function (Blueprint $table) {
            if (! Schema::hasColumn('agencies', 'phone')) {
                $table->string('phone', 30)->nullable()->after('city');
            }
            if (! Schema::hasColumn('agencies', 'email')) {
                $table->string('email')->nullable()->after('phone');
            }
            if (! Schema::hasColumn('agencies', 'is_siege')) {
                $table->boolean('is_siege')->default(false)->after('email');
            }
            if (! Schema::hasColumn('agencies', 'active')) {
                $table->boolean('active')->default(true)->after('is_siege');
            }
        });

        // S'assurer que 'code' a un index unique global (en plus de l'index composé existant)
        // On utilise ALTER TABLE raw pour éviter doctrine/dbal
        $driver = Schema::getConnection()->getDriverName();
        try {
            // Vérifier si l'index unique global existe déjà
            $indexExists = false;
            if ($driver === 'mysql' || $driver === 'mariadb') {
                $indexes = DB::select("SHOW INDEX FROM agencies WHERE Key_name = 'agencies_code_unique'");
                $indexExists = ! empty($indexes);
                if (! $indexExists) {
                    DB::statement('ALTER TABLE agencies ADD UNIQUE KEY agencies_code_unique (code)');
                }
            } elseif ($driver === 'pgsql') {
                $result = DB::select("SELECT indexname FROM pg_indexes WHERE tablename = 'agencies' AND indexname = 'agencies_code_unique'");
                $indexExists = ! empty($result);
                if (! $indexExists) {
                    DB::statement('CREATE UNIQUE INDEX agencies_code_unique ON agencies (code)');
                }
            }
            // sqlite : on tolère sans index unique global
        } catch (\Throwable $e) {
            // Ne pas bloquer si l'index existe déjà ou n'est pas supporté
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('agencies')) {
            $driver = Schema::getConnection()->getDriverName();
            try {
                if ($driver === 'mysql' || $driver === 'mariadb') {
                    DB::statement('ALTER TABLE agencies DROP INDEX agencies_code_unique');
                } elseif ($driver === 'pgsql') {
                    DB::statement('DROP INDEX IF EXISTS agencies_code_unique');
                }
            } catch (\Throwable $e) {}

            Schema::table('agencies', function (Blueprint $table) {
                $cols = ['phone', 'email', 'is_siege', 'active'];
                foreach ($cols as $col) {
                    if (Schema::hasColumn('agencies', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
