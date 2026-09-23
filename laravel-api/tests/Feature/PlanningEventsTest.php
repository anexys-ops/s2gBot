<?php

namespace Tests\Feature;

use App\Models\Equipment;
use App\Models\EquipmentMaintenancePlan;
use App\Models\MaterielAffectation;
use App\Models\PlanningEquipment;
use App\Models\PlanningEvent;
use App\Models\PlanningHuman;
use App\Models\StockEquipment;
use App\Models\StockPersonnel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlanningEventsTest extends TestCase
{
    use RefreshDatabase;

    public function test_unified_table_tracks_personnel_equipment_and_unavailability_changes(): void
    {
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN]);
        $equipment = Equipment::query()->create([
            'name' => 'Densitomètre test',
            'code' => 'PLANNING-EVENT-TEST',
            'type' => 'mesure',
            'status' => Equipment::STATUS_ACTIVE,
        ]);

        $human = PlanningHuman::query()->create([
            'user_id' => $lab->id,
            'date_debut' => '2026-09-23',
            'date_fin' => '2026-09-23',
            'type_evenement' => 'formation',
        ]);
        PlanningEquipment::query()->create([
            'equipment_id' => $equipment->id,
            'user_id' => $lab->id,
            'date_debut' => '2026-09-23',
            'date_fin' => '2026-09-23',
            'type_evenement' => 'utilisation',
        ]);
        StockPersonnel::query()->create([
            'user_id' => $lab->id,
            'date_debut' => '2026-09-24',
            'date_fin' => '2026-09-24',
            'motif' => 'conge',
        ]);
        StockEquipment::query()->create([
            'equipment_id' => $equipment->id,
            'date_debut' => '2026-09-25',
            'date_fin' => '2026-09-25',
            'motif' => 'maintenance',
        ]);

        $affectation = MaterielAffectation::query()->create([
            'equipment_id' => $equipment->id,
            'user_id' => $lab->id,
            'date_debut' => '2026-09-23',
            'date_retour_prevue' => '2026-09-25',
        ]);
        $maintenance = EquipmentMaintenancePlan::query()->create([
            'equipment_id' => $equipment->id,
            'label' => 'Vérification périodique',
            'kind' => 'verification',
            'interval_months' => 12,
            'next_due_at' => '2026-09-25',
            'active' => true,
        ]);

        $this->assertDatabaseCount('planning_events', 6);
        $this->actingAs($lab, 'sanctum')
            ->getJson('/api/planning/overview?from=2026-09-23&to=2026-09-25')
            ->assertOk()
            ->assertJsonCount(6, 'events');

        $affectation->update(['date_retour_effective' => '2026-09-24']);
        $this->assertTrue(PlanningEvent::query()->where('source_type', 'materiel_affectation')
            ->where('source_id', $affectation->id)->whereDate('date_fin', '2026-09-24')->exists());
        $maintenance->update(['active' => false]);
        $this->assertDatabaseCount('planning_events', 5);

        $human->update(['date_fin' => '2026-09-26']);
        $this->assertTrue(PlanningEvent::query()
            ->where('source_type', 'human')
            ->where('source_id', $human->id)
            ->whereDate('date_fin', '2026-09-26')
            ->exists());
        $human->delete();
        $this->assertDatabaseCount('planning_events', 4);
    }
}
