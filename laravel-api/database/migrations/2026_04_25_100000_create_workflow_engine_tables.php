<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('workflow_definitions')) {
            Schema::create('workflow_definitions', function (Blueprint $table) {
                $table->id();
                $table->string('code', 64)->unique();
                $table->string('name');
                $table->string('document_type', 64);
                $table->boolean('active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('workflow_steps')) {
            Schema::create('workflow_steps', function (Blueprint $table) {
                $table->id();
                $table->foreignId('workflow_definition_id')->constrained('workflow_definitions')->cascadeOnDelete();
                $table->string('code', 64);
                $table->string('label');
                $table->unsignedInteger('sort_order')->default(0);
                $table->string('service_key', 64)->nullable();
                $table->boolean('can_edit')->default(false);
                $table->boolean('can_approve')->default(false);
                $table->boolean('can_reject')->default(false);
                $table->unsignedSmallInteger('sla_days')->nullable();
                $table->timestamps();
                $table->unique(['workflow_definition_id', 'code']);
            });
        }

        if (! Schema::hasTable('workflow_transitions')) {
            Schema::create('workflow_transitions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('workflow_definition_id')->constrained('workflow_definitions')->cascadeOnDelete();
                $table->foreignId('from_step_id')->constrained('workflow_steps')->cascadeOnDelete();
                $table->foreignId('to_step_id')->constrained('workflow_steps')->cascadeOnDelete();
                $table->string('name', 128);
                $table->boolean('is_default')->default(false);
                $table->boolean('requires_comment')->default(false);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('workflow_instances')) {
            Schema::create('workflow_instances', function (Blueprint $table) {
                $table->id();
                $table->foreignId('workflow_definition_id')->constrained('workflow_definitions')->cascadeOnDelete();
                $table->foreignId('current_step_id')->constrained('workflow_steps')->restrictOnDelete();
                $table->string('subject_type');
                $table->unsignedBigInteger('subject_id');
                $table->timestamp('started_at')->useCurrent();
                $table->timestamp('completed_at')->nullable();
                $table->foreignId('locked_by')->nullable()->constrained('users')->nullOnDelete();
                $table->json('meta')->nullable();
                $table->timestamps();
                $table->index(['subject_type', 'subject_id']);
            });
        }

        if (! Schema::hasTable('workflow_histories')) {
            Schema::create('workflow_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('workflow_instance_id')->constrained('workflow_instances')->cascadeOnDelete();
                $table->foreignId('from_step_id')->nullable()->constrained('workflow_steps')->nullOnDelete();
                $table->foreignId('to_step_id')->constrained('workflow_steps')->restrictOnDelete();
                $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
                $table->string('action', 32);
                $table->text('comment')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_histories');
        Schema::dropIfExists('workflow_instances');
        Schema::dropIfExists('workflow_transitions');
        Schema::dropIfExists('workflow_steps');
        Schema::dropIfExists('workflow_definitions');
    }
};
