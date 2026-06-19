<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * S2G descriptifs — certains libellés dépassent 255 caractères (ex. D00455, 519 chars).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ref_articles') || ! Schema::hasColumn('ref_articles', 'libelle')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE ref_articles MODIFY libelle TEXT NOT NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('ref_articles') || ! Schema::hasColumn('ref_articles', 'libelle')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE ref_articles MODIFY libelle VARCHAR(255) NOT NULL');
        }
    }
};
