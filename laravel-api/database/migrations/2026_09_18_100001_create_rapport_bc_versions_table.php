<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rapport_bc_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rapport_bc_id')->constrained('rapport_bcs')->cascadeOnDelete();
            $table->unsignedSmallInteger('version_number')->default(1);
            $table->string('file_path')->nullable();
            $table->string('original_filename')->nullable();
            $table->string('file_hash', 32)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('upload_notes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['rapport_bc_id', 'version_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rapport_bc_versions');
    }
};
