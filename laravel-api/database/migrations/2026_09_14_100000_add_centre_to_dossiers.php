<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dossiers', function (Blueprint $table) {
            $table->unsignedBigInteger('lab_centre_group_id')->nullable()->after('mission_id');
            $table->foreign('lab_centre_group_id')->references('id')->on('lab_centre_groups')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('dossiers', function (Blueprint $table) {
            $table->dropForeign(['lab_centre_group_id']);
            $table->dropColumn('lab_centre_group_id');
        });
    }
};
