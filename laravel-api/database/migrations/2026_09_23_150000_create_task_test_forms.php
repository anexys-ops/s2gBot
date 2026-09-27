<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('test_types', function (Blueprint $table) {
            $table->json('form_fields')->nullable();
        });

        Schema::create('article_test_type', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ref_article_id')->constrained('ref_articles')->cascadeOnDelete();
            $table->foreignId('test_type_id')->constrained('test_types')->cascadeOnDelete();
            $table->foreignId('article_action_id')->nullable()->constrained('article_actions')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['ref_article_id', 'test_type_id']);
        });

        Schema::create('task_test_forms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mission_task_id')->constrained('mission_tasks')->cascadeOnDelete();
            $table->foreignId('test_type_id')->constrained('test_types')->restrictOnDelete();
            $table->string('status', 32)->default('draft');
            $table->json('form_snapshot');
            $table->json('answers')->nullable();
            $table->text('correction_note')->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->timestamps();
            $table->unique(['mission_task_id', 'test_type_id']);
        });

        Schema::create('task_test_form_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_test_form_id')->constrained('task_test_forms')->cascadeOnDelete();
            $table->string('field_key', 100);
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 100);
            $table->foreignId('uploaded_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_test_form_photos');
        Schema::dropIfExists('task_test_forms');
        Schema::dropIfExists('article_test_type');
        Schema::table('test_types', fn (Blueprint $table) => $table->dropColumn('form_fields'));
    }
};
