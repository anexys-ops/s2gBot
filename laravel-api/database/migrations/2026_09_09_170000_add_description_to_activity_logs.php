<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('activity_logs', 'description')) {
                $table->text('description')->nullable()->after('action');
            }
        });

        Schema::table('activity_logs_archive', function (Blueprint $table) {
            if (! Schema::hasColumn('activity_logs_archive', 'description')) {
                $table->text('description')->nullable()->after('action');
            }
        });
    }

    public function down(): void
    {
        Schema::table('activity_logs_archive', function (Blueprint $table) {
            if (Schema::hasColumn('activity_logs_archive', 'description')) {
                $table->dropColumn('description');
            }
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            if (Schema::hasColumn('activity_logs', 'description')) {
                $table->dropColumn('description');
            }
        });
    }
};
