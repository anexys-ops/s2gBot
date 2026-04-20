<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Equipment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Sample;
use App\Models\TestType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TestResultEquipmentTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: Sample, 1: \App\Models\TestTypeParam, 2: Equipment, 3: Equipment, 4: int} */
    private function fixtures(): array
    {
        $client = Client::create(['name' => 'EqCo']);
        $hqId = (int) Agency::query()->where('client_id', $client->id)->where('is_headquarters', true)->value('id');
        $branch = Agency::create([
            'client_id' => $client->id,
            'name' => 'Agence B',
            'code' => 'AG-B-'.uniqid(),
            'is_headquarters' => false,
        ]);

        $tt = TestType::create([
            'name' => 'Essai équipement',
            'norm' => null,
            'unit' => null,
            'unit_price' => '10.00',
            'thresholds' => null,
        ]);
        $param = $tt->params()->create([
            'name' => 'Mesure',
            'unit' => 'mm',
            'expected_type' => 'numeric',
        ]);

        $order = Order::create([
            'reference' => 'ORD-EQ-'.uniqid(),
            'client_id' => $client->id,
            'agency_id' => $hqId,
            'status' => Order::STATUS_IN_PROGRESS,
            'order_date' => now()->toDateString(),
        ]);
        $oi = OrderItem::create([
            'order_id' => $order->id,
            'test_type_id' => $tt->id,
            'quantity' => 1,
        ]);
        $sample = Sample::create([
            'order_item_id' => $oi->id,
            'reference' => 'S-EQ-'.uniqid(),
            'status' => Sample::STATUS_RECEIVED,
        ]);

        $equipmentOk = Equipment::create([
            'name' => 'Appareil A',
            'code' => 'EQ-A-'.uniqid(),
            'agency_id' => $hqId,
            'status' => Equipment::STATUS_ACTIVE,
        ]);
        $equipmentOk->testTypes()->attach($tt->id);

        $equipmentWrongAgency = Equipment::create([
            'name' => 'Appareil B',
            'code' => 'EQ-B-'.uniqid(),
            'agency_id' => $branch->id,
            'status' => Equipment::STATUS_ACTIVE,
        ]);
        $equipmentWrongAgency->testTypes()->attach($tt->id);

        return [$sample, $param, $equipmentOk, $equipmentWrongAgency, $tt->id];
    }

    public function test_store_result_with_valid_equipment_id(): void
    {
        [$sample, $param, $equipmentOk] = $this->fixtures();
        $tech = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($tech, 'sanctum')
            ->postJson("/api/samples/{$sample->id}/results", [
                'results' => [
                    [
                        'test_type_param_id' => $param->id,
                        'value' => '12.5',
                        'equipment_id' => $equipmentOk->id,
                    ],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('test_results.0.equipment_id', $equipmentOk->id);
    }

    public function test_store_result_rejects_equipment_wrong_agency(): void
    {
        [$sample, $param, , $equipmentWrongAgency] = $this->fixtures();
        $tech = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($tech, 'sanctum')
            ->postJson("/api/samples/{$sample->id}/results", [
                'results' => [
                    [
                        'test_type_param_id' => $param->id,
                        'value' => '1',
                        'equipment_id' => $equipmentWrongAgency->id,
                    ],
                ],
            ])
            ->assertStatus(422);
    }

    public function test_store_result_rejects_equipment_not_linked_to_test_type(): void
    {
        [$sample, $param, $equipmentOk, , $ttId] = $this->fixtures();
        $otherType = TestType::create([
            'name' => 'Autre essai',
            'norm' => null,
            'unit' => null,
            'unit_price' => '5.00',
            'thresholds' => null,
        ]);
        $equipmentOk->testTypes()->detach();
        $equipmentOk->testTypes()->attach($otherType->id);
        $this->assertNotSame($ttId, $otherType->id);

        $tech = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($tech, 'sanctum')
            ->postJson("/api/samples/{$sample->id}/results", [
                'results' => [
                    [
                        'test_type_param_id' => $param->id,
                        'value' => '1',
                        'equipment_id' => $equipmentOk->id,
                    ],
                ],
            ])
            ->assertStatus(422);
    }
}
