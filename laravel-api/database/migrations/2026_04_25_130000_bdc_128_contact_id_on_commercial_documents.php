<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('client_contacts')) {
            return;
        }

        if (Schema::hasTable('quotes') && ! Schema::hasColumn('quotes', 'contact_id')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->foreignId('contact_id')->nullable()->after('client_id')->constrained('client_contacts')->nullOnDelete();
            });
        }
        if (Schema::hasTable('invoices') && ! Schema::hasColumn('invoices', 'contact_id')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->foreignId('contact_id')->nullable()->after('client_id')->constrained('client_contacts')->nullOnDelete();
            });
        }
        if (Schema::hasTable('bons_commande') && ! Schema::hasColumn('bons_commande', 'contact_id')) {
            Schema::table('bons_commande', function (Blueprint $table) {
                $table->foreignId('contact_id')->nullable()->after('client_id')->constrained('client_contacts')->nullOnDelete();
            });
        }
        if (Schema::hasTable('bons_livraison') && ! Schema::hasColumn('bons_livraison', 'contact_id')) {
            Schema::table('bons_livraison', function (Blueprint $table) {
                $table->foreignId('contact_id')->nullable()->after('client_id')->constrained('client_contacts')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('bons_livraison') && Schema::hasColumn('bons_livraison', 'contact_id')) {
            Schema::table('bons_livraison', function (Blueprint $table) {
                $table->dropConstrainedForeignId('contact_id');
            });
        }
        if (Schema::hasTable('bons_commande') && Schema::hasColumn('bons_commande', 'contact_id')) {
            Schema::table('bons_commande', function (Blueprint $table) {
                $table->dropConstrainedForeignId('contact_id');
            });
        }
        if (Schema::hasTable('invoices') && Schema::hasColumn('invoices', 'contact_id')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropConstrainedForeignId('contact_id');
            });
        }
        if (Schema::hasTable('quotes') && Schema::hasColumn('quotes', 'contact_id')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->dropConstrainedForeignId('contact_id');
            });
        }
    }
};
