<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountingExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_admin_can_download_sage_csv(): void
    {
        $client = Client::create(['name' => 'ExpCo']);
        $agencyId = Agency::query()->where('client_id', $client->id)->where('is_headquarters', true)->value('id');

        Invoice::create([
            'number' => 'FAC-EXP-1',
            'client_id' => $client->id,
            'agency_id' => $agencyId,
            'invoice_date' => '2026-02-15',
            'due_date' => '2026-03-15',
            'amount_ht' => '100.00',
            'amount_ttc' => '120.00',
            'tva_rate' => '20.00',
            'status' => Invoice::STATUS_PAID,
        ]);

        $admin = User::factory()->labAdmin()->create();

        $response = $this->actingAs($admin, 'sanctum')->get(
            '/api/accounting/exports?format=sage&from=2026-02-01&to=2026-02-28'
        );

        $response->assertOk();
        $response->assertHeader('content-disposition');
        $this->assertStringContainsString('Journal', $response->streamedContent());
        $this->assertStringContainsString('FAC-EXP-1', $response->streamedContent());
    }

    public function test_lab_technician_cannot_export(): void
    {
        $tech = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($tech, 'sanctum')
            ->get('/api/accounting/exports?format=sage&from=2026-01-01&to=2026-01-31')
            ->assertForbidden();
    }
}
