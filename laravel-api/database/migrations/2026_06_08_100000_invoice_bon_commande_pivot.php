<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_bon_commande', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('bon_commande_id')->constrained('bons_commande')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['invoice_id', 'bon_commande_id']);
            $table->index('bon_commande_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_bon_commande');
    }
};
