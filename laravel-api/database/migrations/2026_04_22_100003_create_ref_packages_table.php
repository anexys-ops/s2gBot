<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ref_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ref_famille_package_id')->constrained('ref_famille_packages')->cascadeOnDelete();
            $table->string('code');
            $table->string('libelle');
            $table->text('description')->nullable();
            $table->decimal('prix_ht', 10, 2)->default(0);
            $table->decimal('tva_rate', 5, 2)->default(20);
            $table->boolean('actif')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['ref_famille_package_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ref_packages');
    }
};
