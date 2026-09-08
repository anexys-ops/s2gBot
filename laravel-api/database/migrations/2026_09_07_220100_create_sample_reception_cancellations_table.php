<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sample_reception_cancellations')) {
            Schema::create('sample_reception_cancellations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('bon_commande_ligne_id')->constrained('bons_commande_lignes')->cascadeOnDelete();
                $table->unsignedSmallInteger('reception_index');
                $table->unsignedSmallInteger('reception_batch_total');
                $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('reason', 500)->nullable();
                $table->timestamps();
                $table->index(['bon_commande_ligne_id', 'reception_index']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sample_reception_cancellations');
    }
};
