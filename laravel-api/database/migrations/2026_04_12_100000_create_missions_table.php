<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('missions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_id')->constrained()->cascadeOnDelete();
            $table->string('reference')->unique();
            $table->string('title')->nullable();
            $table->string('mission_status')->default('g1');
            $table->string('maitre_ouvrage_name')->nullable();
            $table->string('maitre_ouvrage_email')->nullable();
            $table->string('maitre_ouvrage_phone')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('missions');
    }
};
