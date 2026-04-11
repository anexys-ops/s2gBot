<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['clients', 'sites', 'orders', 'quotes', 'invoices', 'missions'] as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->json('meta')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['clients', 'sites', 'orders', 'quotes', 'invoices', 'missions'] as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropColumn('meta');
            });
        }
    }
};
