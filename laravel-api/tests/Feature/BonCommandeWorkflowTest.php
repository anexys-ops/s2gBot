<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Dossier;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BonCommandeWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_transforms_signed_quote_to_bon_commande(): void
    {
        $client = Client::query()->create(['name' => 'BC Test Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site 1']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2099-0001',
            'titre' => 'D1',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $q = Quote::query()->create([
            'number' => 'Q-1',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'quote_date' => '2026-02-01',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $q->id,
            'description' => 'Essai A',
            'quantity' => 1,
            'unit_price' => 100,
            'tva_rate' => 20,
            'total' => 100,
        ]);

        $r = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/devis/{$q->id}/transformer-bc");
        $r->assertCreated();
        $r->assertJsonPath('numero', 'BCC-2026-0001');
        $r->assertJsonPath('lignes.0.libelle', 'Essai A');
        $this->assertNotNull(Quote::query()->find($q->id)->meta);
    }

    public function test_gest_confirmer_transformer_bl_valider(): void
    {
        $client = Client::query()->create(['name' => 'BC Flow Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'S']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2099-0002',
            'titre' => 'D2',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $q = Quote::query()->create([
            'number' => 'Q-2',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'quote_date' => '2026-02-01',
            'amount_ht' => 50,
            'amount_ttc' => 60,
            'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $q->id,
            'description' => 'L1',
            'quantity' => 1,
            'unit_price' => 50,
            'tva_rate' => 20,
            'total' => 50,
        ]);
        $bc = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/devis/{$q->id}/transformer-bc")->json();
        $bcId = (int) $bc['id'];

        $c = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-commande/{$bcId}/confirmer");
        $c->assertOk();
        $c->assertJsonPath('statut', 'confirme');

        $bl = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-commande/{$bcId}/transformer-bl");
        $bl->assertCreated();
        $bl->assertJsonPath('numero', 'BLC-2026-0001');
        $blId = (int) $bl->json('id');
        $lineId = (int) $bl->json('lignes.0.id');

        $u = $this->actingAs($lab, 'sanctum')->putJson("/api/v1/bons-livraison/{$blId}", [
            'lignes' => [
                ['id' => $lineId, 'quantite_livree' => 1],
            ],
        ]);
        $u->assertOk();

        $v = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-livraison/{$blId}/valider");
        $v->assertOk();
        $v->assertJsonPath('statut', 'livre');
    }

    public function test_guest_cannot_transform_devis(): void
    {
        $this->postJson('/api/v1/devis/1/transformer-bc')->assertUnauthorized();
    }
}
