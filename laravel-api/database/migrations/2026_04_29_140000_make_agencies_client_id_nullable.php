<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * v1.2.0 — Bug seeders : MaterielDemoSeeder créait des Agency sans client_id
 *  (ce sont des agences internes du laboratoire, pas rattachées à un client).
 *
 * Migration : rendre `agencies.client_id` nullable.
 *  - MySQL/MariaDB : ALTER TABLE ... MODIFY (pas de doctrine/dbal en prod).
 *  - PostgreSQL    : ALTER COLUMN ... DROP NOT NULL.
 *  - SQLite        : tolérée — recréer la table demande un workaround,
 *                    et les seeders concernés ne sont pas joués sous SQLite en prod.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('agencies') || ! Schema::hasColumn('agencies', 'client_id')) {
            return;
        }
        $driver = Schema::getConnection()->getDriverName();
        try {
            if ($driver === 'mysql' || $driver === 'mariadb') {
                DB::statement('ALTER TABLE agencies MODIFY client_id BIGINT UNSIGNED NULL');
            } elseif ($driver === 'pgsql') {
                DB::statement('ALTER TABLE agencies ALTER COLUMN client_id DROP NOT NULL');
            }
            // sqlite : on tolère.
        } catch (\Throwable $e) {
            // Si le driver / la contrainte FK refuse la modification, on n'échoue pas.
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('agencies') || ! Schema::hasColumn('agencies', 'client_id')) {
            return;
        }
        $driver = Schema::getConnection()->getDriverName();
        try {
            if ($driver === 'mysql' || $driver === 'mariadb') {
                DB::statement('ALTER TABLE agencies MODIFY client_id BIGINT UNSIGNED NOT NULL');
            } elseif ($driver === 'pgsql') {
                DB::statement('ALTER TABLE agencies ALTER COLUMN client_id SET NOT NULL');
            }
        } catch (\Throwable $e) {}
    }
};
