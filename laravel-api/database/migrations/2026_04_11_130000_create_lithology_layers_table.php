<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lithology_layers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('borehole_id')->constrained()->cascadeOnDelete();
            $table->decimal('depth_from_m', 8, 3);
            $table->decimal('depth_to_m', 8, 3);
            $table->text('description');
            $table->decimal('rqd', 5, 2)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lithology_layers');
    }
};
