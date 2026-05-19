<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration 3 — Ajout des champs triggers ODM et ressource sur ref_articles
 *
 * Colonnes ajoutées (avec guard hasColumn) :
 *  - triggers_odm_terrain      : boolean, déclencheur d'ODM terrain
 *  - triggers_odm_labo         : boolean, déclencheur d'ODM labo
 *  - triggers_odm_ingenieur    : boolean, déclencheur d'ODM ingénieur
 *  - triggers_ndf              : boolean, déclencheur de note de frais
 *  - triggers_materiel_booking : boolean, déclencheur de réservation matériel
 *  - nb_par_sondage            : quantité par sondage (défaut 1)
 *  - type_ressource            : override de la famille pour le type de ressource
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ref_articles')) {
            return;
        }

        Schema::table('ref_articles', function (Blueprint $table) {
            if (! Schema::hasColumn('ref_articles', 'triggers_odm_terrain')) {
                $table->boolean('triggers_odm_terrain')->default(false)->after('actif');
            }
            if (! Schema::hasColumn('ref_articles', 'triggers_odm_labo')) {
                $table->boolean('triggers_odm_labo')->default(false)->after('triggers_odm_terrain');
            }
            if (! Schema::hasColumn('ref_articles', 'triggers_odm_ingenieur')) {
                $table->boolean('triggers_odm_ingenieur')->default(false)->after('triggers_odm_labo');
            }
            if (! Schema::hasColumn('ref_articles', 'triggers_ndf')) {
                $table->boolean('triggers_ndf')->default(false)->after('triggers_odm_ingenieur');
            }
            if (! Schema::hasColumn('ref_articles', 'triggers_materiel_booking')) {
                $table->boolean('triggers_materiel_booking')->default(false)->after('triggers_ndf');
            }
            if (! Schema::hasColumn('ref_articles', 'nb_par_sondage')) {
                $table->unsignedSmallInteger('nb_par_sondage')->default(1)->after('triggers_materiel_booking');
            }
            if (! Schema::hasColumn('ref_articles', 'type_ressource')) {
                $table->string('type_ressource', 32)->nullable()->after('nb_par_sondage')
                    ->comment('Override de la famille pour le type de ressource');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('ref_articles')) {
            return;
        }

        Schema::table('ref_articles', function (Blueprint $table) {
            $cols = [
                'triggers_odm_terrain',
                'triggers_odm_labo',
                'triggers_odm_ingenieur',
                'triggers_ndf',
                'triggers_materiel_booking',
                'nb_par_sondage',
                'type_ressource',
            ];
            foreach ($cols as $col) {
                if (Schema::hasColumn('ref_articles', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
