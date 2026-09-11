<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            if (! Schema::hasColumn('samples', 'transco_number')) {
                $table->string('transco_number', 32)->nullable()->unique()->after('fold_number')
                    ->comment('Numéro transco simple (code-barres)');
            }
        });
    }

    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            if (Schema::hasColumn('samples', 'transco_number')) {
                $table->dropUnique(['transco_number']);
                $table->dropColumn('transco_number');
            }
        });
    }
};
