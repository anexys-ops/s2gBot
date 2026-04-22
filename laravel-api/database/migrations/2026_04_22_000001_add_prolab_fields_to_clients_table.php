<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // `city` peut déjà exister (ex. 2026_04_13_160000_morocco_client_fields).
        if (! Schema::hasColumn('clients', 'prolab_code')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->string('prolab_code', 10)->nullable()->after('siret');
            });
            Schema::table('clients', function (Blueprint $table) {
                $table->unique('prolab_code');
            });
        }
        if (! Schema::hasColumn('clients', 'country')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->string('country', 5)->default('MA');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('clients', 'country')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->dropColumn('country');
            });
        }
        if (Schema::hasColumn('clients', 'prolab_code')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->dropUnique(['prolab_code']);
            });
            Schema::table('clients', function (Blueprint $table) {
                $table->dropColumn('prolab_code');
            });
        }
    }
};
