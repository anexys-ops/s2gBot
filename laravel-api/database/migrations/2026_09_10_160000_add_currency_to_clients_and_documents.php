<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('currency_code', 3)->default('MAD')->after('country');
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->string('currency_code', 3)->default('MAD')->after('amount_ttc');
            $table->decimal('exchange_rate', 12, 6)->nullable()->after('currency_code');
            $table->date('exchange_rate_date')->nullable()->after('exchange_rate');
            $table->decimal('amount_ht_base', 12, 2)->nullable()->after('exchange_rate_date');
            $table->decimal('amount_ttc_base', 12, 2)->nullable()->after('amount_ht_base');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('currency_code', 3)->default('MAD')->after('amount_ttc');
            $table->decimal('exchange_rate', 12, 6)->nullable()->after('currency_code');
            $table->date('exchange_rate_date')->nullable()->after('exchange_rate');
            $table->decimal('amount_ht_base', 12, 2)->nullable()->after('exchange_rate_date');
            $table->decimal('amount_ttc_base', 12, 2)->nullable()->after('amount_ht_base');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['currency_code', 'exchange_rate', 'exchange_rate_date', 'amount_ht_base', 'amount_ttc_base']);
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn(['currency_code', 'exchange_rate', 'exchange_rate_date', 'amount_ht_base', 'amount_ttc_base']);
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('currency_code');
        });
    }
};
