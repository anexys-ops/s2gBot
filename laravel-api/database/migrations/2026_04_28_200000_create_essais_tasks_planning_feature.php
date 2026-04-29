<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Feature : Essais / Tâches / Planning / Stock
 *
 * Nouvelles tables :
 *  - action_measure_configs    : configuration des champs/mesures d'un formulaire par action produit
 *  - mission_tasks             : tâche concrète générée depuis une ligne d'ordre de mission
 *  - task_measures             : valeur saisie par le personnel pour une mesure
 *  - task_results              : résultat final validé d'une tâche
 *  - planning_humans           : affectation personnel ↔ tâche ↔ créneau
 *  - planning_equipments       : affectation équipement ↔ tâche ↔ créneau
 *  - stock_personnels          : indisponibilités / congés personnels
 *  - stock_equipments          : indisponibilités / maintenance équipements
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Configuration des mesures par action ─────────────────────────────
        Schema::create('action_measure_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_action_id')
                ->constrained('article_actions')
                ->cascadeOnDelete();
            $table->string('field_name', 128)->comment('Libellé de la mesure, ex: Résistance compression');
            $table->string('field_type', 32)->default('number')
                ->comment('number | text | select | date | file | boolean');
            $table->string('unit', 32)->nullable()->comment('MPa, mm, °C, %, etc.');
            $table->decimal('min_value', 12, 4)->nullable();
            $table->decimal('max_value', 12, 4)->nullable();
            $table->json('select_options')->nullable()
                ->comment('Options pour field_type=select, ex: ["Oui","Non","NA"]');
            $table->boolean('is_required')->default(true);
            $table->string('placeholder', 255)->nullable();
            $table->text('help_text')->nullable();
            $table->unsignedTinyInteger('ordre')->default(0);
            $table->timestamps();

            $table->index(['article_action_id', 'ordre']);
        });

        // ── Tâches concrètes (une par ligne d'OM, avec formulaire) ──────────
        Schema::create('mission_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ordre_mission_ligne_id')
                ->constrained('ordre_mission_lignes')
                ->cascadeOnDelete();
            $table->foreignId('assigned_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('statut', 32)->default('todo')
                ->comment('todo | in_progress | done | validated | rejected');
            $table->date('planned_date')->nullable();
            $table->date('due_date')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->foreignId('validated_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->text('notes')->nullable();
            $table->boolean('is_conform')->nullable()
                ->comment('Calculé automatiquement à partir des mesures');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['ordre_mission_ligne_id', 'statut']);
            $table->index('assigned_user_id');
        });

        // ── Mesures saisies par le personnel ─────────────────────────────────
        Schema::create('task_measures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mission_task_id')
                ->constrained('mission_tasks')
                ->cascadeOnDelete();
            $table->foreignId('measure_config_id')
                ->constrained('action_measure_configs')
                ->cascadeOnDelete();
            $table->text('value')->nullable()->comment('Valeur saisie (texte générique)');
            $table->decimal('value_numeric', 12, 4)->nullable()
                ->comment('Valeur numérique si field_type=number');
            $table->boolean('is_conform')->nullable()
                ->comment('True si value_numeric entre min_value et max_value');
            $table->string('attachment_path', 512)->nullable()
                ->comment('Chemin du fichier joint (photo, PDF)');
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamps();

            $table->index(['mission_task_id', 'measure_config_id']);
        });

        // ── Résultats validés ────────────────────────────────────────────────
        Schema::create('task_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mission_task_id')
                ->unique()
                ->constrained('mission_tasks')
                ->cascadeOnDelete();
            $table->boolean('is_conform')->default(false);
            $table->decimal('value_final', 12, 4)->nullable()
                ->comment('Valeur principale retenue');
            $table->string('conclusion', 512)->nullable();
            $table->text('observations')->nullable();
            $table->foreignId('validated_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->string('rapport_path', 512)->nullable();
            $table->timestamps();
        });

        // ── Planning humain ──────────────────────────────────────────────────
        Schema::create('planning_humans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->foreignId('mission_task_id')
                ->nullable()
                ->constrained('mission_tasks')
                ->nullOnDelete();
            $table->date('date_debut');
            $table->date('date_fin');
            $table->time('heure_debut')->nullable();
            $table->time('heure_fin')->nullable();
            $table->string('type_evenement', 32)->default('tache')
                ->comment('tache | conge | formation | absent | autre');
            $table->string('notes', 512)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'date_debut', 'date_fin']);
            $table->index('mission_task_id');
        });

        // ── Planning matériel ────────────────────────────────────────────────
        Schema::create('planning_equipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('equipment_id')
                ->constrained('equipments')
                ->cascadeOnDelete();
            $table->foreignId('mission_task_id')
                ->nullable()
                ->constrained('mission_tasks')
                ->nullOnDelete();
            $table->date('date_debut');
            $table->date('date_fin');
            $table->string('type_evenement', 32)->default('utilisation')
                ->comment('utilisation | maintenance | indispo | autre');
            $table->string('notes', 512)->nullable();
            $table->timestamps();

            $table->index(['equipment_id', 'date_debut', 'date_fin']);
        });

        // ── Stock / Indisponibilités personnel ───────────────────────────────
        Schema::create('stock_personnels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->date('date_debut');
            $table->date('date_fin');
            $table->string('motif', 64)->default('conge')
                ->comment('conge | maladie | formation | autre');
            $table->boolean('is_validated')->default(false);
            $table->string('notes', 512)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'date_debut', 'date_fin']);
        });

        // ── Stock / Indisponibilités matériel ────────────────────────────────
        Schema::create('stock_equipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('equipment_id')
                ->constrained('equipments')
                ->cascadeOnDelete();
            $table->date('date_debut');
            $table->date('date_fin');
            $table->string('motif', 64)->default('maintenance')
                ->comment('maintenance | panne | calibration | autre');
            $table->boolean('is_validated')->default(false);
            $table->string('notes', 512)->nullable();
            $table->timestamps();

            $table->index(['equipment_id', 'date_debut', 'date_fin']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_equipments');
        Schema::dropIfExists('stock_personnels');
        Schema::dropIfExists('planning_equipments');
        Schema::dropIfExists('planning_humans');
        Schema::dropIfExists('task_results');
        Schema::dropIfExists('task_measures');
        Schema::dropIfExists('mission_tasks');
        Schema::dropIfExists('action_measure_configs');
    }
};
