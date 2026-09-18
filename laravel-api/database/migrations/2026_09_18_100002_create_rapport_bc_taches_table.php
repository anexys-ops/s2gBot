<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rapport_bc_taches', function (Blueprint $table) {
            $table->foreignId('rapport_bc_id')->constrained('rapport_bcs')->cascadeOnDelete();
            $table->foreignId('mission_task_id')->constrained('mission_tasks')->cascadeOnDelete();

            $table->primary(['rapport_bc_id', 'mission_task_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rapport_bc_taches');
    }
};
