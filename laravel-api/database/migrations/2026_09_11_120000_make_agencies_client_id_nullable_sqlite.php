<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rend agencies.client_id nullable sur SQLite (CI).
 * La migration 2026_04_29 ne gérait que MySQL/PostgreSQL.
 * Laravel 11 supporte change() sur SQLite nativement via rebuild de table.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('agencies') || ! Schema::hasColumn('agencies', 'client_id')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            return;
        }

        Schema::table('agencies', function (Blueprint $table) {
            $table->unsignedBigInteger('client_id')->nullable()->change();
        });
    }

    public function down(): void {}
};
