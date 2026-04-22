<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('prolab_code', 10)->nullable()->unique()->after('siret');
            $table->string('city', 100)->nullable()->after('address');
            $table->string('country', 5)->default('MA')->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['prolab_code', 'city', 'country']);
        });
    }
};
