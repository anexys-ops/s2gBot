<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('test_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('norm')->nullable();
            $table->string('unit')->nullable();
            $table->decimal('unit_price', 10, 2)->default(0);
            $table->json('thresholds')->nullable();
            $table->timestamps();
        });

        Schema::create('test_type_params', function (Blueprint $table) {
            $table->id();
            $table->foreignId('test_type_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('unit')->nullable();
            $table->string('expected_type')->default('numeric');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('test_type_params');
        Schema::dropIfExists('test_types');
    }
};
