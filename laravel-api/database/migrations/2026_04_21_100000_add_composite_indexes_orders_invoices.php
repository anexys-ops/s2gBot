<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->index(['client_id', 'status'], 'invoices_client_status_idx');
            $table->index(['status', 'due_date'], 'invoices_status_due_idx');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->index(['client_id', 'status'], 'orders_client_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('invoices_client_status_idx');
            $table->dropIndex('invoices_status_due_idx');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_client_status_idx');
        });
    }
};
