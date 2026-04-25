<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('client_contacts') && ! Schema::hasColumn('client_contacts', 'contact_type')) {
            Schema::table('client_contacts', function (Blueprint $table) {
                $table->string('contact_type', 32)->default('commercial')->after('client_id');
            });
        }

        if (Schema::hasTable('missions') && Schema::hasTable('bons_commande') && ! Schema::hasColumn('missions', 'bon_commande_id')) {
            Schema::table('missions', function (Blueprint $table) {
                $table->foreignId('bon_commande_id')->nullable()->after('dossier_id')->constrained('bons_commande')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('missions') && Schema::hasColumn('missions', 'bon_commande_id')) {
            Schema::table('missions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('bon_commande_id');
            });
        }

        if (Schema::hasTable('client_contacts') && Schema::hasColumn('client_contacts', 'contact_type')) {
            Schema::table('client_contacts', function (Blueprint $table) {
                $table->dropColumn('contact_type');
            });
        }
    }
};
