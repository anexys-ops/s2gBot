<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('samples', 'nature_echantillon')) {
            return;
        }
        Schema::table('samples', function (Blueprint $table) {
            $table->string('nature_echantillon', 191)->nullable()->after('sample_type');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('samples', 'nature_echantillon')) {
            return;
        }
        Schema::table('samples', function (Blueprint $table) {
            $table->dropColumn('nature_echantillon');
        });
    }
};
