<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expense_reports', function (Blueprint $table) {
            $table->dropForeign(['ordre_mission_id']);
        });

        Schema::table('expense_reports', function (Blueprint $table) {
            $table->unsignedBigInteger('ordre_mission_id')->nullable()->change();
            $table->foreign('ordre_mission_id')
                ->references('id')
                ->on('ordres_mission')
                ->nullOnDelete();

            $table->foreignId('user_id')
                ->nullable()
                ->after('ordre_mission_id')
                ->constrained('users')
                ->nullOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->decimal('expense_taux_km', 8, 4)->default(0.4010)->after('poste');
            $table->decimal('expense_plafond_repas', 10, 2)->nullable()->after('expense_taux_km');
            $table->decimal('expense_forfait_repas', 10, 2)->nullable()->after('expense_plafond_repas');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['expense_taux_km', 'expense_plafond_repas', 'expense_forfait_repas']);
        });

        Schema::table('expense_reports', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });

        Schema::table('expense_reports', function (Blueprint $table) {
            $table->dropForeign(['ordre_mission_id']);
        });

        Schema::table('expense_reports', function (Blueprint $table) {
            $table->unsignedBigInteger('ordre_mission_id')->nullable(false)->change();
            $table->foreign('ordre_mission_id')
                ->references('id')
                ->on('ordres_mission')
                ->cascadeOnDelete();
        });
    }
};
