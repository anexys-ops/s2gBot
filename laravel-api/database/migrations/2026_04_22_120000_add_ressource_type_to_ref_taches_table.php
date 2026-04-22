<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ref_taches', function (Blueprint $table) {
            $table->string('ressource_type', 64)->nullable()->after('duree_estimee');
        });
    }

    public function down(): void
    {
        Schema::table('ref_taches', function (Blueprint $table) {
            $table->dropColumn('ressource_type');
        });
    }
};
