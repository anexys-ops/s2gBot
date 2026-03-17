<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lab_cadrage', function (Blueprint $table) {
            $table->id();
            $table->json('types_essais_demarrage')->nullable(); // ['beton','sols','granulats','bitume','acier']
            $table->json('normes_referentiels')->nullable();   // ['NF','EN','ASTM','methodes_internes']
            $table->string('perimetre')->nullable();            // '1_labo' | 'multi_sites' | 'mobile_chantier'
            $table->json('tracabilite_iso17025')->nullable();  // { audit_trail: true, signatures: true, etalonnages: true }
            $table->json('checklist_done')->nullable();         // { types: true, normes: true, ... }
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_cadrage');
    }
};
