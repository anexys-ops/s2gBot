<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expense_lines', function (Blueprint $table) {
            $table->string('lieu_depart', 255)->nullable()->after('description');
            $table->string('lieu_arrivee', 255)->nullable()->after('lieu_depart');
            $table->decimal('distance_km', 8, 2)->nullable()->after('lieu_arrivee');
            $table->decimal('taux_km', 6, 4)->nullable()->after('distance_km');
            $table->string('type_transport', 32)->nullable()->after('taux_km');
        });

        if (! Schema::hasTable('frais_deplacement')) {
            return;
        }

        $reportIdsByOm = [];
        $reportStatutPriority = [
            'draft'     => 0,
            'brouillon' => 0,
            'soumis'    => 1,
            'valide'    => 2,
            'rembourse' => 3,
        ];

        $fraisRows = DB::table('frais_deplacement')->orderBy('id')->get();

        foreach ($fraisRows as $frais) {
            $omId = (int) $frais->ordre_mission_id;
            if (! isset($reportIdsByOm[$omId])) {
                $existing = DB::table('expense_reports')
                    ->where('ordre_mission_id', $omId)
                    ->whereNull('deleted_at')
                    ->orderBy('id')
                    ->value('id');

                if ($existing) {
                    $reportIdsByOm[$omId] = (int) $existing;
                } else {
                    $reportIdsByOm[$omId] = DB::table('expense_reports')->insertGetId([
                        'unique_number'      => $this->nextNdfNumber(),
                        'ordre_mission_id'   => $omId,
                        'statut'             => 'brouillon',
                        'notes'              => null,
                        'created_by'         => $frais->user_id,
                        'validated_by'       => null,
                        'validated_at'       => null,
                        'created_at'         => $frais->created_at ?? now(),
                        'updated_at'         => $frais->updated_at ?? now(),
                        'deleted_at'         => null,
                    ]);
                }
            }

            $distance = (float) ($frais->distance_km ?? 0);
            $taux = (float) ($frais->taux_km ?? 0.401);
            $amount = round($distance * $taux * 2, 2);

            $trajet = trim(implode(' → ', array_filter([$frais->lieu_depart, $frais->lieu_arrivee])));
            $description = $frais->notes;
            if ($description === null || $description === '') {
                $description = $trajet !== ''
                    ? "Déplacement {$trajet}"
                    : 'Déplacement kilométrique';
            }

            DB::table('expense_lines')->insert([
                'expense_report_id' => $reportIdsByOm[$omId],
                'user_id'           => $frais->user_id,
                'category'          => 'Voyage',
                'amount'            => $amount,
                'date'              => $frais->date,
                'description'       => $description,
                'receipt_path'      => null,
                'lieu_depart'       => $frais->lieu_depart,
                'lieu_arrivee'      => $frais->lieu_arrivee,
                'distance_km'       => $distance,
                'taux_km'           => $taux,
                'type_transport'    => $frais->type_transport ?? 'voiture',
                'created_at'        => $frais->created_at ?? now(),
                'updated_at'        => $frais->updated_at ?? now(),
            ]);

            $mappedStatut = match ($frais->statut ?? 'draft') {
                'valide'    => 'valide',
                'rembourse' => 'rembourse',
                default     => 'brouillon',
            };

            $currentStatut = DB::table('expense_reports')
                ->where('id', $reportIdsByOm[$omId])
                ->value('statut') ?? 'brouillon';

            if (($reportStatutPriority[$mappedStatut] ?? 0) > ($reportStatutPriority[$currentStatut] ?? 0)) {
                DB::table('expense_reports')
                    ->where('id', $reportIdsByOm[$omId])
                    ->update(['statut' => $mappedStatut, 'updated_at' => now()]);
            }
        }

        Schema::dropIfExists('frais_deplacement');
    }

    public function down(): void
    {
        Schema::create('frais_deplacement', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ordre_mission_id')->constrained('ordres_mission')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('date');
            $table->string('lieu_depart', 255)->nullable();
            $table->string('lieu_arrivee', 255)->nullable();
            $table->decimal('distance_km', 8, 2)->default(0);
            $table->decimal('taux_km', 6, 4)->default(0.4010);
            $table->decimal('montant', 10, 2)->storedAs('ROUND(distance_km * taux_km * 2, 2)');
            $table->string('type_transport', 32)->default('voiture');
            $table->text('notes')->nullable();
            $table->string('statut', 32)->default('draft');
            $table->timestamps();
            $table->index(['ordre_mission_id', 'user_id']);
        });

        Schema::table('expense_lines', function (Blueprint $table) {
            $table->dropColumn([
                'lieu_depart',
                'lieu_arrivee',
                'distance_km',
                'taux_km',
                'type_transport',
            ]);
        });
    }

    private function nextNdfNumber(): string
    {
        $row = DB::table('sequences')->where('type', 'NDF')->lockForUpdate()->first();
        if (! $row) {
            return 'NDF-10000001';
        }
        $next = ((int) $row->last_value) + 1;
        DB::table('sequences')->where('type', 'NDF')->update([
            'last_value' => $next,
            'updated_at' => now(),
        ]);

        return 'NDF-' . $next;
    }
};
