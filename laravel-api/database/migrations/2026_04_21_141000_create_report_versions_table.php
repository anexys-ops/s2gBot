<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->json('form_data')->nullable();
            $table->string('review_status', 32)->nullable();
            $table->string('file_path')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('change_reason', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['report_id', 'version_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_versions');
    }
};
