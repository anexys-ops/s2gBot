<?php

namespace Tests\Feature;

use App\Models\BcLignePlanningAffectation;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TerrainPlanningPdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_can_generate_daily_terrain_planning_pdf_with_default_template(): void
    {
        [$lab, $technician, $line] = $this->seedPlanningRow();

        BcLignePlanningAffectation::query()->create([
            'bon_commande_ligne_id' => $line->id,
            'user_id' => $technician->id,
            'date_debut' => '2026-09-22',
            'date_fin' => '2026-09-22',
            'notes' => 'Prévenir le chef de chantier avant le départ.',
            'created_by' => $lab->id,
        ]);

        $response = $this->actingAs($lab, 'sanctum')->postJson('/api/v1/planning-terrain/pdf', [
            'from' => '2026-09-22',
            'to' => '2026-09-22',
            'user_id' => $technician->id,
        ]);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertStringStartsWith('application/pdf', (string) $response->headers->get('content-type'));
        ob_start();
        $response->sendContent();
        $pdfBytes = (string) ob_get_clean();
        $this->assertStringStartsWith('%PDF-', $pdfBytes);
        $this->assertDatabaseHas('document_pdf_templates', [
            'document_type' => 'terrain_planning',
            'slug' => 'planning-terrain-classique',
            'is_default' => true,
        ]);
    }

    public function test_client_cannot_generate_internal_terrain_planning_pdf(): void
    {
        $clientUser = User::factory()->create(['role' => User::ROLE_CLIENT]);

        $this->actingAs($clientUser, 'sanctum')->postJson('/api/v1/planning-terrain/pdf', [
            'from' => '2026-09-22',
            'to' => '2026-09-28',
        ])->assertForbidden();
    }

    /** @return array{User, User, BonCommandeLigne} */
    private function seedPlanningRow(): array
    {
        $client = Client::query()->create(['name' => 'Client planning PDF']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier planning']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $technician = User::factory()->create([
            'name' => 'Technicien Terrain',
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-PLANNING-PDF',
            'titre' => 'Programme terrain',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-09-01',
            'created_by' => $lab->id,
        ]);
        $order = BonCommande::query()->create([
            'numero' => 'BCC-PLANNING-PDF',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_CONFIRME,
            'date_commande' => '2026-09-01',
            'montant_ht' => 300,
            'montant_ttc' => 360,
            'tva_rate' => 20,
            'created_by' => $lab->id,
        ]);
        $line = BonCommandeLigne::query()->create([
            'bon_commande_id' => $order->id,
            'libelle' => 'Contrôle de compacité sur plateforme',
            'ordre' => 1,
            'quantite' => 3,
            'quantite_devis' => 3,
            'prix_unitaire_ht' => 100,
            'tva_rate' => 20,
            'montant_ht' => 300,
            'notes_ligne' => 'Apporter le densitomètre.',
        ]);

        return [$lab, $technician, $line];
    }
}
