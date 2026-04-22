<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('non_conformities', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->timestamp('detected_at');
            $table->foreignId('detected_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sample_id')->nullable()->constrained('samples')->nullOnDelete();
            $table->foreignId('equipment_id')->nullable()->constrained('equipments')->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('severity', 32);
            $table->text('description');
            $table->string('status', 32);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['status', 'detected_at']);
            $table->index('severity');
        });

        Schema::create('corrective_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('non_conformity_id')->constrained('non_conformities')->cascadeOnDelete();
            $table->string('title');
            $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->string('status', 32);
            $table->text('verification_notes')->nullable();
            $table->timestamps();

            $table->index(['non_conformity_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('corrective_actions');
        Schema::dropIfExists('non_conformities');
    }
};
