<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expense_lines', function (Blueprint $table) {
            $table->string('payment_method', 32)->nullable()->after('amount');
            $table->string('receipt_filename', 255)->nullable()->after('receipt_path');
        });
    }

    public function down(): void
    {
        Schema::table('expense_lines', function (Blueprint $table) {
            $table->dropColumn(['payment_method', 'receipt_filename']);
        });
    }
};
