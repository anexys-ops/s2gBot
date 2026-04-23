<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reglements')) {
            Schema::create('reglements', function (Blueprint $table) {
                $table->id();
                $table->string('numero')->unique();
                $table->foreignId('client_id')->constrained()->cascadeOnDelete();
                $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
                $table->foreignId('bon_livraison_id')->nullable()->constrained('bons_livraison')->nullOnDelete();
                $table->decimal('amount_ttc', 12, 2);
                $table->string('payment_mode', 32)->default('virement');
                $table->date('payment_date');
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('situations_travaux')) {
            Schema::create('situations_travaux', function (Blueprint $table) {
                $table->id();
                $table->string('numero')->unique();
                $table->foreignId('dossier_id')->constrained('dossiers')->cascadeOnDelete();
                $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
                $table->string('label');
                $table->decimal('percent_complete', 5, 2)->default(0);
                $table->decimal('amount_ht', 12, 2)->default(0);
                $table->string('status', 32)->default('brouillon');
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('invoice_credits')) {
            Schema::create('invoice_credits', function (Blueprint $table) {
                $table->id();
                $table->string('numero')->unique();
                $table->foreignId('client_id')->constrained()->cascadeOnDelete();
                $table->foreignId('source_invoice_id')->constrained('invoices')->cascadeOnDelete();
                $table->decimal('amount_ttc', 12, 2);
                $table->string('status', 32)->default('brouillon');
                $table->text('reason')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_credits');
        Schema::dropIfExists('situations_travaux');
        Schema::dropIfExists('reglements');
    }
};
