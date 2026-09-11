<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->boolean('ca_annuel_tva_regime')
                ->default(false)
                ->after('ice')
                ->comment('CA annuel : TVA 25 % récupérable, 75 % reversée à l’État');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('ca_annuel_tva_regime');
        });
    }
};
