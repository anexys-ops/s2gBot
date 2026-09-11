<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('equipment_maintenance_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('equipment_id')->constrained('equipments')->cascadeOnDelete();
            $table->string('label', 128);
            $table->string('kind', 32)->default('etalonnage')
                ->comment('etalonnage | maintenance | verification');
            $table->unsignedSmallInteger('interval_months');
            $table->date('next_due_at');
            $table->date('last_performed_at')->nullable();
            $table->string('provider', 255)->nullable();
            $table->text('notes')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['equipment_id', 'next_due_at']);
            $table->index(['active', 'next_due_at']);
        });

        Schema::table('calibrations', function (Blueprint $table) {
            $table->foreignId('maintenance_plan_id')
                ->nullable()
                ->after('equipment_id')
                ->constrained('equipment_maintenance_plans')
                ->nullOnDelete();
        });

        Schema::table('planning_equipments', function (Blueprint $table) {
            if (! Schema::hasColumn('planning_equipments', 'user_id')) {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('mission_task_id')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('planning_equipments', function (Blueprint $table) {
            if (Schema::hasColumn('planning_equipments', 'user_id')) {
                $table->dropConstrainedForeignId('user_id');
            }
        });

        Schema::table('calibrations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('maintenance_plan_id');
        });

        Schema::dropIfExists('equipment_maintenance_plans');
    }
};
