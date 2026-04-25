<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Référents S2G sur la table clients :
 *  - commercial_id         : commercial S2G en charge
 *  - responsable_technique_id : responsable technique S2G
 *  - responsable_facturation_id : référent facturation S2G
 *  - responsable_recouvrement_id : référent recouvrement S2G
 *  - lat / lng             : coordonnées GPS (pour vue carte)
 *
 * + contact_id par défaut sur dossiers (si manquant)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            if (! Schema::hasColumn('clients', 'commercial_id')) {
                $table->foreignId('commercial_id')
                    ->nullable()->after('meta')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('clients', 'responsable_technique_id')) {
                $table->foreignId('responsable_technique_id')
                    ->nullable()->after('commercial_id')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('clients', 'responsable_facturation_id')) {
                $table->foreignId('responsable_facturation_id')
                    ->nullable()->after('responsable_technique_id')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('clients', 'responsable_recouvrement_id')) {
                $table->foreignId('responsable_recouvrement_id')
                    ->nullable()->after('responsable_facturation_id')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('clients', 'lat')) {
                $table->decimal('lat', 10, 7)->nullable()->after('responsable_recouvrement_id');
            }
            if (! Schema::hasColumn('clients', 'lng')) {
                $table->decimal('lng', 10, 7)->nullable()->after('lat');
            }
        });

        // contact_id sur dossiers si pas encore présent
        if (Schema::hasTable('dossiers') && Schema::hasTable('client_contacts')
            && ! Schema::hasColumn('dossiers', 'contact_id')) {
            Schema::table('dossiers', function (Blueprint $table) {
                $table->foreignId('contact_id')
                    ->nullable()->after('client_id')
                    ->constrained('client_contacts')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('dossiers') && Schema::hasColumn('dossiers', 'contact_id')) {
            Schema::table('dossiers', function (Blueprint $table) {
                $table->dropConstrainedForeignId('contact_id');
            });
        }

        Schema::table('clients', function (Blueprint $table) {
            foreach (['commercial_id', 'responsable_technique_id', 'responsable_facturation_id', 'responsable_recouvrement_id', 'lat', 'lng'] as $col) {
                if (Schema::hasColumn('clients', $col)) {
                    if (str_ends_with($col, '_id')) {
                        $table->dropConstrainedForeignId($col);
                    } else {
                        $table->dropColumn($col);
                    }
                }
            }
        });
    }
};
