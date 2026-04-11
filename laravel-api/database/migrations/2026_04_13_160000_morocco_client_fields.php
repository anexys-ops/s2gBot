<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('city', 128)->nullable()->after('address');
            $table->string('postal_code', 16)->nullable()->after('city');
            $table->string('whatsapp', 50)->nullable()->after('phone');
            $table->string('ice', 32)->nullable()->after('siret');
            $table->string('rc', 80)->nullable()->after('ice');
            $table->string('patente', 64)->nullable()->after('rc');
            $table->string('if_number', 32)->nullable()->after('patente');
            $table->string('legal_form', 64)->nullable()->after('if_number');
            $table->string('cnss_employer', 32)->nullable()->after('legal_form');
            $table->decimal('capital_social', 15, 2)->nullable()->after('cnss_employer');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn([
                'city',
                'postal_code',
                'whatsapp',
                'ice',
                'rc',
                'patente',
                'if_number',
                'legal_form',
                'cnss_employer',
                'capital_social',
            ]);
        });
    }
};
