<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Dossier;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DossierPdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_dossier_pdf_can_be_generated(): void
    {
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $client = Client::query()->create(['name' => 'Client PDF dossier']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier PDF']);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-PDF-1',
            'titre' => 'Dossier PDF',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);

        $res = $this->actingAs($lab, 'sanctum')->postJson('/api/pdf/generate', ['type' => 'dossier', 'id' => $dossier->id]);

        $res->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $res->headers->get('content-type'));
    }
}
