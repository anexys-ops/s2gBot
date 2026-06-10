<?php

namespace Tests\Feature;

use App\Models\Equipment;
use App\Models\EquipmentMaintenancePlan;
use App\Models\MaterielAffectation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EquipmentMaintenanceAndAffectationTest extends TestCase
{
    use RefreshDatabase;

    private function createEquipment(string $code): Equipment
    {
        return Equipment::create([
            'name' => 'Presse test',
            'code' => $code,
            'status' => Equipment::STATUS_ACTIVE,
        ]);
    }

    public function test_lab_admin_can_manage_maintenance_plans_and_record_intervention(): void
    {
        $admin = User::factory()->labAdmin()->create();
        $equipment = $this->createEquipment('EQ-PLAN-'.uniqid());

        $this->actingAs($admin, 'sanctum');

        $create = $this->postJson("/api/equipments/{$equipment->id}/maintenance-plans", [
            'label' => 'Étalonnage annuel',
            'kind' => EquipmentMaintenancePlan::KIND_ETALONNAGE,
            'interval_months' => 12,
            'next_due_at' => now()->addMonth()->toDateString(),
        ])->assertCreated();

        $planId = (int) $create->json('id');

        $this->getJson("/api/equipments/{$equipment->id}/maintenance-plans")
            ->assertOk()
            ->assertJsonFragment(['label' => 'Étalonnage annuel']);

        $this->postJson("/api/equipments/{$equipment->id}/maintenance-plans/{$planId}/record", [
            'performed_at' => now()->toDateString(),
            'result' => 'ok',
            'notes' => 'Contrôle OK',
        ])->assertOk()
            ->assertJsonPath('calibration.result', 'ok');

        $this->assertDatabaseHas('calibrations', [
            'equipment_id' => $equipment->id,
            'maintenance_plan_id' => $planId,
        ]);

        $plan = EquipmentMaintenancePlan::findOrFail($planId);
        $this->assertNotNull($plan->last_performed_at);

        $this->putJson("/api/equipments/{$equipment->id}/maintenance-plans/{$planId}", [
            'label' => 'Étalonnage bisannuel',
            'interval_months' => 24,
            'next_due_at' => now()->addMonths(24)->toDateString(),
        ])->assertOk()
            ->assertJsonPath('label', 'Étalonnage bisannuel');

        $this->deleteJson("/api/equipments/{$equipment->id}/maintenance-plans/{$planId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('equipment_maintenance_plans', ['id' => $planId]);
    }

    public function test_due_plans_endpoint_returns_events_in_range(): void
    {
        $admin = User::factory()->labAdmin()->create();
        $equipment = $this->createEquipment('EQ-DUE-'.uniqid());

        EquipmentMaintenancePlan::create([
            'equipment_id' => $equipment->id,
            'label' => 'Maintenance mensuelle',
            'kind' => EquipmentMaintenancePlan::KIND_MAINTENANCE,
            'interval_months' => 1,
            'next_due_at' => now()->startOfMonth()->toDateString(),
            'active' => true,
        ]);

        $this->actingAs($admin, 'sanctum');

        $from = now()->startOfMonth()->toDateString();
        $to = now()->endOfMonth()->toDateString();

        $this->getJson("/api/equipments-maintenance-plans/due?from={$from}&to={$to}")
            ->assertOk()
            ->assertJsonFragment(['equipment_id' => $equipment->id]);
    }

    public function test_lab_admin_can_manage_equipment_affectations(): void
    {
        $admin = User::factory()->labAdmin()->create();
        $technician = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);
        $equipment = $this->createEquipment('EQ-AFF-'.uniqid());

        $this->actingAs($admin, 'sanctum');

        $create = $this->postJson("/api/equipments/{$equipment->id}/affectations", [
            'user_id' => $technician->id,
            'date_debut' => now()->toDateString(),
            'date_retour_prevue' => now()->addDays(5)->toDateString(),
            'observations' => 'Chantier démo',
        ])->assertCreated();

        $affectationId = (int) $create->json('id');

        $this->getJson("/api/equipments/{$equipment->id}/affectations")
            ->assertOk()
            ->assertJsonFragment(['observations' => 'Chantier démo']);

        $from = now()->subDay()->toDateString();
        $to = now()->addWeek()->toDateString();

        $this->getJson("/api/materiel/affectations?from={$from}&to={$to}&equipment_id={$equipment->id}")
            ->assertOk()
            ->assertJsonFragment(['id' => $affectationId]);

        $this->putJson("/api/equipments/{$equipment->id}/affectations/{$affectationId}", [
            'observations' => 'Prolongation chantier',
            'date_retour_prevue' => now()->addDays(10)->toDateString(),
        ])->assertOk()
            ->assertJsonPath('observations', 'Prolongation chantier');

        $this->deleteJson("/api/equipments/{$equipment->id}/affectations/{$affectationId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('materiel_affectations', ['id' => $affectationId]);
    }

    public function test_lab_technician_can_read_but_not_create_plans(): void
    {
        $tech = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);
        $equipment = $this->createEquipment('EQ-RO-'.uniqid());

        $this->actingAs($tech, 'sanctum');

        $this->getJson("/api/equipments/{$equipment->id}/maintenance-plans")->assertOk();

        $this->postJson("/api/equipments/{$equipment->id}/maintenance-plans", [
            'label' => 'Test',
            'interval_months' => 6,
            'next_due_at' => now()->addMonth()->toDateString(),
        ])->assertForbidden();
    }

    public function test_maintenance_plan_due_dates_expand_in_range(): void
    {
        $plan = EquipmentMaintenancePlan::make([
            'interval_months' => 1,
            'next_due_at' => now()->startOfMonth()->toDateString(),
            'active' => true,
        ]);

        $from = now()->startOfMonth()->toDateString();
        $to = now()->startOfMonth()->addDays(45)->toDateString();

        $dates = $plan->dueDatesInRange($from, $to);

        $this->assertGreaterThanOrEqual(2, count($dates));
        $this->assertContains($from, $dates);
    }

    public function test_equipment_show_includes_planning_slots_and_maintenance_plans(): void
    {
        $admin = User::factory()->labAdmin()->create();
        $equipment = $this->createEquipment('EQ-SHOW-'.uniqid());

        EquipmentMaintenancePlan::create([
            'equipment_id' => $equipment->id,
            'label' => 'Contrôle semestriel',
            'kind' => EquipmentMaintenancePlan::KIND_VERIFICATION,
            'interval_months' => 6,
            'next_due_at' => now()->addMonths(6)->toDateString(),
            'active' => true,
        ]);

        \App\Models\PlanningEquipment::create([
            'equipment_id' => $equipment->id,
            'date_debut' => now()->toDateString(),
            'date_fin' => now()->addDays(3)->toDateString(),
            'type_evenement' => 'utilisation',
            'user_id' => $admin->id,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/equipments/{$equipment->id}")
            ->assertOk()
            ->assertJsonPath('id', $equipment->id)
            ->assertJsonCount(1, 'maintenance_plans')
            ->assertJsonCount(1, 'planning_slots');
    }
}
