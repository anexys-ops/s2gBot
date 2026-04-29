<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Séquences uniques 8 chiffres + Notes de frais
 *
 * - sequences         : compteur séquentiel par type (OM, NDF, MAT, TSK)
 * - expense_reports   : rapport de frais lié à un ordre de mission
 * - expense_lines     : ligne de frais individuelle
 *
 * Ajout de numéros uniques aux tables existantes :
 *  - ordres_mission      : unique_number
 *  - mission_tasks       : unique_number
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Table sequences ──────────────────────────────────────────────────
        Schema::create('sequences', function (Blueprint $table) {
            $table->id();
            $table->string('type', 16)->unique()->comment('OM | NDF | MAT | TSK');
            $table->unsignedBigInteger('last_value')->default(10000000)
                ->comment('Dernier numéro attribué');
            $table->timestamps();
        });

        // Initialiser les séquences
        DB::table('sequences')->insert([
            ['type' => 'OM',  'last_value' => 10000000, 'created_at' => now(), 'updated_at' => now()],
            ['type' => 'NDF', 'last_value' => 10000000, 'created_at' => now(), 'updated_at' => now()],
            ['type' => 'MAT', 'last_value' => 10000000, 'created_at' => now(), 'updated_at' => now()],
            ['type' => 'TSK', 'last_value' => 10000000, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // ── Numéros uniques sur ordres_mission ───────────────────────────────
        if (!Schema::hasColumn('ordres_mission', 'unique_number')) {
            Schema::table('ordres_mission', function (Blueprint $table) {
                $table->string('unique_number', 16)->nullable()->unique()->after('numero')
                    ->comment('Numéro séquentiel 8 chiffres ex: OM-10000001');
            });
        }

        // ── Numéros uniques sur mission_tasks ────────────────────────────────
        if (!Schema::hasColumn('mission_tasks', 'unique_number')) {
            Schema::table('mission_tasks', function (Blueprint $table) {
                $table->string('unique_number', 16)->nullable()->unique()->after('id')
                    ->comment('Numéro séquentiel 8 chiffres ex: TSK-10000001');
            });
        }

        // ── Notes de frais (rapport) ─────────────────────────────────────────
        Schema::create('expense_reports', function (Blueprint $table) {
            $table->id();
            $table->string('unique_number', 16)->unique()
                ->comment('NDF-10000001');
            $table->foreignId('ordre_mission_id')
                ->constrained('ordres_mission')
                ->cascadeOnDelete();
            $table->string('statut', 32)->default('brouillon')
                ->comment('brouillon | soumis | valide | rembourse | rejete');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('validated_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('ordre_mission_id');
        });

        // ── Lignes de frais ───────────────────────────────────────────────────
        Schema::create('expense_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expense_report_id')
                ->constrained('expense_reports')
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained('users')
                ->comment('Personnel qui a engagé la dépense');
            $table->string('category', 64)
                ->comment('Essence | Hotel | Voyage | Repas | Peage | Parking | Divers');
            $table->decimal('amount', 10, 2)->comment('Montant TTC');
            $table->date('date');
            $table->string('description', 512)->nullable();
            $table->string('receipt_path', 512)->nullable()
                ->comment('Chemin du justificatif');
            $table->timestamps();

            $table->index(['expense_report_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expense_lines');
        Schema::dropIfExists('expense_reports');

        if (Schema::hasColumn('mission_tasks', 'unique_number')) {
            Schema::table('mission_tasks', function (Blueprint $table) {
                $table->dropColumn('unique_number');
            });
        }
        if (Schema::hasColumn('ordres_mission', 'unique_number')) {
            Schema::table('ordres_mission', function (Blueprint $table) {
                $table->dropColumn('unique_number');
            });
        }

        Schema::dropIfExists('sequences');
    }
};
