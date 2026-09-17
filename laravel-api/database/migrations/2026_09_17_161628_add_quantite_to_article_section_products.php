<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('article_section_products', function (Blueprint $table) {
            $table->unsignedSmallInteger('quantite')->default(1)->after('ordre');
        });
    }

    public function down(): void
    {
        Schema::table('article_section_products', function (Blueprint $table) {
            $table->dropColumn('quantite');
        });
    }
};
