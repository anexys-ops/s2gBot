<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration 7 — Tables lab_reports et lab_report_sections
 *
 * lab_reports :
 *   Rapport de laboratoire émis à partir d'un BC / dossier.
 *   Cycle de vie : brouillon → en_validation → valide → signe → emis
 *
 * lab_report_sections :
 *   Section d'un rapport (par échantillon + essai), avec données brutes,
 *   conditions environnementales et résultat de conformité.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lab_reports')) {
            Schema::create('lab_reports', function (Blueprint $table) {
                $table->id();
                $table->string('number', 30)->unique()
                    ->comment('Numéro ex: MHD-RPT-0001');
                $table->unsignedBigInteger('bc_id')->nullable()
                    ->comment('FK bons_commande');
                $table->unsignedBigInteger('dossier_id')->nullable();
                $table->unsignedBigInteger('client_id')->nullable();
                $table->unsignedBigInteger('site_id')->nullable();
                $table->unsignedBigInteger('agency_id')->nullable();
                $table->unsignedBigInteger('technician_id')->nullable()
                    ->comment('FK users');
                $table->unsignedBigInteger('validator_id')->nullable()
                    ->comment('FK users');
                $table->string('status', 30)->default('brouillon')
                    ->comment('brouillon|en_validation|valide|signe|emis');
                $table->string('title');
                $table->text('conclusion')->nullable();
                $table->text('notes_internes')->nullable();
                $table->timestamp('signed_at')->nullable();
                $table->timestamp('emitted_at')->nullable();
                $table->timestamps();
                $table->softDeletes();

                // FK nullable (pas de contraintes bloquantes)
                $table->foreign('bc_id')
                    ->references('id')
                    ->on('bons_commande')
                    ->nullOnDelete();
                $table->foreign('dossier_id')
                    ->references('id')
                    ->on('dossiers')
                    ->nullOnDelete();
                $table->foreign('client_id')
                    ->references('id')
                    ->on('clients')
                    ->nullOnDelete();
                $table->foreign('site_id')
                    ->references('id')
                    ->on('sites')
                    ->nullOnDelete();
                $table->foreign('agency_id')
                    ->references('id')
                    ->on('agencies')
                    ->nullOnDelete();
                $table->foreign('technician_id')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
                $table->foreign('validator_id')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();

                $table->index(['status', 'agency_id']);
                $table->index('dossier_id');
                $table->index('bc_id');
            });
        }

        if (! Schema::hasTable('lab_report_sections')) {
            Schema::create('lab_report_sections', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('report_id');
                $table->unsignedBigInteger('sample_id')->nullable()
                    ->comment('FK samples');
                $table->unsignedBigInteger('essai_article_id')->nullable()
                    ->comment('FK ref_articles — article de type essai');
                $table->unsignedBigInteger('technician_id')->nullable()
                    ->comment('FK users');
                $table->unsignedBigInteger('equipment_id')->nullable()
                    ->comment('FK equipments');
                $table->unsignedSmallInteger('ordre')->default(0);
                $table->date('performed_at')->nullable();
                $table->decimal('temperature_c', 5, 1)->nullable();
                $table->decimal('humidity_pct', 5, 1)->nullable();
                $table->json('data')->nullable()
                    ->comment('Mesures brutes au format JSON');
                $table->string('conformity', 20)->default('en_attente')
                    ->comment('conforme|non_conforme|en_attente');
                $table->text('conclusion')->nullable();
                $table->timestamps();

                $table->foreign('report_id')
                    ->references('id')
                    ->on('lab_reports')
                    ->cascadeOnDelete();
                $table->foreign('sample_id')
                    ->references('id')
                    ->on('samples')
                    ->nullOnDelete();
                $table->foreign('essai_article_id')
                    ->references('id')
                    ->on('ref_articles')
                    ->nullOnDelete();
                $table->foreign('technician_id')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
                $table->foreign('equipment_id')
                    ->references('id')
                    ->on('equipments')
                    ->nullOnDelete();

                $table->index(['report_id', 'ordre']);
                $table->index('sample_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_report_sections');
        Schema::dropIfExists('lab_reports');
    }
};
