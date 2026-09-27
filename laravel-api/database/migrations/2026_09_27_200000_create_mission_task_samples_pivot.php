<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Rattache des prélèvements (FOLD) à une tâche labo. Un même FOLD peut nourrir
        // plusieurs tâches (essais différents), et une tâche labo peut regrouper
        // plusieurs FOLD.
        Schema::create('mission_task_samples', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mission_task_id')->constrained('mission_tasks')->cascadeOnDelete();
            $table->foreignId('sample_id')->constrained('samples')->cascadeOnDelete();
            $table->boolean('forced')->default(false)
                ->comment('Rattaché hors filtre jalon (case "Forcer")');
            $table->timestamps();

            $table->unique(['mission_task_id', 'sample_id']);
        });

        Schema::table('mission_tasks', function (Blueprint $table) {
            $table->boolean('no_fold_required')->default(false)->after('cancellation_reason')
                ->comment('Tâche labo planifiable sans FOLD rattaché (case "Pas de FOLD nécessaire")');
        });
    }

    public function down(): void
    {
        Schema::table('mission_tasks', function (Blueprint $table) {
            $table->dropColumn('no_fold_required');
        });
        Schema::dropIfExists('mission_task_samples');
    }
};
