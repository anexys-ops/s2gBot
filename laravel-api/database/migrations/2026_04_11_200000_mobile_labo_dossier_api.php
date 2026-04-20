<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mobile_measure_submissions', function (Blueprint $table) {
            $table->id();
            $table->string('dossier_kind', 16);
            $table->unsignedBigInteger('dossier_id');
            $table->unsignedBigInteger('form_template_id');
            $table->string('client_submission_id')->unique();
            $table->timestamp('submitted_at')->nullable();
            $table->json('values');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['dossier_kind', 'dossier_id']);
        });

        Schema::create('mobile_dossier_photos', function (Blueprint $table) {
            $table->id();
            $table->string('dossier_kind', 16);
            $table->unsignedBigInteger('dossier_id');
            $table->string('filename');
            $table->string('mime_type', 128);
            $table->timestamp('captured_at')->nullable();
            $table->string('label')->nullable();
            $table->string('client_upload_id')->nullable()->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['dossier_kind', 'dossier_id']);
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('mobile_dossier_photos');
        Schema::dropIfExists('mobile_measure_submissions');
        if (Schema::hasTable('module_settings')) {
            DB::table('module_settings')->where('module_key', 'mobile_labo_terrain')->delete();
        }
    }
};
