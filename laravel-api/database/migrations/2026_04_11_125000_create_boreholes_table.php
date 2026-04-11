<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boreholes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mission_id')->constrained()->cascadeOnDelete();
            $table->string('code');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('ground_level_m', 8, 3)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['mission_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boreholes');
    }
};
