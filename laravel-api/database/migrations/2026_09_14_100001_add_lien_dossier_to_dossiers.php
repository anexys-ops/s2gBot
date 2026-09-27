<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dossiers', function (Blueprint $table) {
            $table->unsignedBigInteger('lien_dossier_id')->nullable()->after('lab_centre_group_id');
            $table->foreign('lien_dossier_id')->references('id')->on('dossiers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('dossiers', function (Blueprint $table) {
            $table->dropForeign(['lien_dossier_id']);
            $table->dropColumn('lien_dossier_id');
        });
    }
};
