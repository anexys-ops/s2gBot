<?php

namespace Tests\Feature;

use App\Models\BcLignePlanningAffectation;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
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

    public function test_update_bc_ligne_persists_planning_extra_fields(): void
    {
        $client = Client::query()->create(['name' => 'BC Ligne Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site L']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $tech = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2099-0010',
            'titre' => 'D10',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $q = Quote::query()->create([
            'number' => 'Q-10',
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
            'description' => 'Essai planif',
            'quantity' => 1,
            'unit_price' => 100,
            'tva_rate' => 20,
            'total' => 100,
        ]);
        $bc = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/devis/{$q->id}/transformer-bc")->json();
        $bcId = (int) $bc['id'];
        $ligneId = (int) $bc['lignes'][0]['id'];

        $r = $this->actingAs($lab, 'sanctum')->putJson("/api/v1/bons-commande/{$bcId}/lignes/{$ligneId}", [
            'technicien_id' => $tech->id,
            'date_livraison' => '2026-03-15',
            'notes_ligne' => 'Accès chantier nord',
        ]);
        $r->assertOk();
        $r->assertJsonPath('technicien_id', $tech->id);
        $r->assertJsonPath('date_livraison', '2026-03-15');
        $r->assertJsonPath('notes_ligne', 'Accès chantier nord');

        $ligne = BonCommandeLigne::query()->findOrFail($ligneId);
        $this->assertSame($tech->id, $ligne->technicien_id);
        $this->assertSame('2026-03-15', $ligne->date_livraison?->format('Y-m-d'));
        $this->assertSame('Accès chantier nord', $ligne->notes_ligne);
    }

    public function test_update_bc_ligne_syncs_terrain_planning_affectation(): void
    {
        $client = Client::query()->create(['name' => 'BC Sync Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site S']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $tech = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2099-0011',
            'titre' => 'D11',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $q = Quote::query()->create([
            'number' => 'Q-11',
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
            'description' => 'Essai sync',
            'quantity' => 1,
            'unit_price' => 100,
            'tva_rate' => 20,
            'total' => 100,
        ]);
        $bc = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/devis/{$q->id}/transformer-bc")->json();
        $bcId = (int) $bc['id'];
        $ligneId = (int) $bc['lignes'][0]['id'];

        $r = $this->actingAs($lab, 'sanctum')->putJson("/api/v1/bons-commande/{$bcId}/lignes/{$ligneId}", [
            'date_debut_prevue' => '2026-04-10',
            'date_fin_prevue' => '2026-04-14',
            'technicien_id' => $tech->id,
            'notes_ligne' => 'Mission terrain',
        ]);
        $r->assertOk();
        $r->assertJsonPath('date_debut_prevue', '2026-04-10');
        $r->assertJsonPath('date_fin_prevue', '2026-04-14');

        $aff = BcLignePlanningAffectation::query()->where('bon_commande_ligne_id', $ligneId)->first();
        $this->assertNotNull($aff);
        $this->assertSame($tech->id, $aff->user_id);
        $this->assertSame('2026-04-10', $aff->date_debut->format('Y-m-d'));
        $this->assertSame('2026-04-14', $aff->date_fin->format('Y-m-d'));
        $this->assertSame('Mission terrain', $aff->notes);
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

    public function test_quotes_eligible_bc_filter_excludes_draft_and_existing_bc(): void
    {
        $client = Client::query()->create(['name' => 'Eligible BC Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site E']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2099-0003',
            'titre' => 'D3',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);

        $eligible = Quote::query()->create([
            'number' => 'Q-ELIG',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'quote_date' => '2026-02-01',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_ACCEPTED,
        ]);
        Quote::query()->create([
            'number' => 'Q-DRAFT',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'quote_date' => '2026-02-01',
            'amount_ht' => 50,
            'amount_ttc' => 60,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
        ]);
        $withBc = Quote::query()->create([
            'number' => 'Q-HASBC',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'dossier_id' => $dossier->id,
            'quote_date' => '2026-02-01',
            'amount_ht' => 80,
            'amount_ttc' => 96,
            'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED,
        ]);
        BonCommande::query()->create([
            'numero' => 'BCC-TEST-1',
            'quote_id' => $withBc->id,
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'date_commande' => '2026-02-02',
            'montant_ht' => 80,
            'montant_ttc' => 96,
            'statut' => BonCommande::STATUT_BROUILLON,
            'created_by' => $lab->id,
        ]);

        $r = $this->actingAs($lab, 'sanctum')->getJson('/api/quotes?eligible_bc=1');
        $r->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertContains($eligible->id, $ids);
        $this->assertNotContains($withBc->id, $ids);
        $this->assertCount(1, $ids);
    }

    public function test_bl_show_includes_delivery_tracking_on_lignes(): void
    {
        [$lab, $bcId, $blId, $blLineId, $bcLineId] = $this->seedBcWithBl();

        BonCommandeLigne::query()->whereKey($bcLineId)->update(['quantite' => 5]);

        $show = $this->actingAs($lab, 'sanctum')->getJson("/api/v1/bons-livraison/{$blId}");
        $show->assertOk();
        $show->assertJsonPath('lignes.0.quantite_commandee', 5);
        $show->assertJsonPath('lignes.0.quantite_deja_livree', 0);
        $show->assertJsonPath('lignes.0.quantite_restante', 5);

        $this->actingAs($lab, 'sanctum')->putJson("/api/v1/bons-livraison/{$blId}", [
            'lignes' => [['id' => $blLineId, 'quantite_livree' => 2]],
        ])->assertOk();
        $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-livraison/{$blId}/valider")->assertOk();

        $bl2 = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-commande/{$bcId}/transformer-bl");
        $bl2->assertCreated();
        $bl2Id = (int) $bl2->json('id');

        $show2 = $this->actingAs($lab, 'sanctum')->getJson("/api/v1/bons-livraison/{$bl2Id}");
        $show2->assertOk();
        $show2->assertJsonPath('lignes.0.quantite_commandee', 5);
        $show2->assertJsonPath('lignes.0.quantite_deja_livree', 2);
        $show2->assertJsonPath('lignes.0.quantite_restante', 3);
        $show2->assertJsonPath('autres_bons_livraison.0.id', $blId);
    }

    public function test_bl_rejects_quantity_over_remaining(): void
    {
        [$lab, $bcId, $blId, $blLineId, $bcLineId] = $this->seedBcWithBl();

        BonCommandeLigne::query()->whereKey($bcLineId)->update(['quantite' => 5]);

        $this->actingAs($lab, 'sanctum')->putJson("/api/v1/bons-livraison/{$blId}", [
            'lignes' => [['id' => $blLineId, 'quantite_livree' => 3]],
        ])->assertOk();
        $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-livraison/{$blId}/valider")->assertOk();

        $bl2 = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-commande/{$bcId}/transformer-bl");
        $bl2Id = (int) $bl2->json('id');
        $bl2LineId = (int) $bl2->json('lignes.0.id');

        $over = $this->actingAs($lab, 'sanctum')->putJson("/api/v1/bons-livraison/{$bl2Id}", [
            'lignes' => [['id' => $bl2LineId, 'quantite_livree' => 3]],
        ]);
        $over->assertStatus(422);

        $ok = $this->actingAs($lab, 'sanctum')->putJson("/api/v1/bons-livraison/{$bl2Id}", [
            'lignes' => [['id' => $bl2LineId, 'quantite_livree' => 2]],
        ]);
        $ok->assertOk();
        $ok->assertJsonPath('lignes.0.quantite_livree', 2);
    }

    public function test_bl_brouillon_quantities_not_counted_as_deja_livree(): void
    {
        [$lab, $bcId, $blId, $blLineId, $bcLineId] = $this->seedBcWithBl();

        BonCommandeLigne::query()->whereKey($bcLineId)->update(['quantite' => 5]);

        $this->actingAs($lab, 'sanctum')->putJson("/api/v1/bons-livraison/{$blId}", [
            'lignes' => [['id' => $blLineId, 'quantite_livree' => 4]],
        ])->assertOk();

        $bl2 = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-commande/{$bcId}/transformer-bl");
        $bl2Id = (int) $bl2->json('id');

        $show2 = $this->actingAs($lab, 'sanctum')->getJson("/api/v1/bons-livraison/{$bl2Id}");
        $show2->assertJsonPath('lignes.0.quantite_deja_livree', 0);
        $show2->assertJsonPath('lignes.0.quantite_restante', 5);
    }

    /**
     * @return array{0: User, 1: int, 2: int, 3: int, 4: int}
     */
    private function seedBcWithBl(): array
    {
        $client = Client::query()->create(['name' => 'BL Delivery Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site BL']);
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2099-0099',
            'titre' => 'D BL',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $lab->id,
        ]);
        $q = Quote::query()->create([
            'number' => 'Q-BL-DEL',
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
            'description' => 'Essai livraison',
            'quantity' => 1,
            'unit_price' => 50,
            'tva_rate' => 20,
            'total' => 50,
        ]);
        $bc = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/devis/{$q->id}/transformer-bc")->json();
        $bcId = (int) $bc['id'];
        $bcLineId = (int) $bc['lignes'][0]['id'];
        $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-commande/{$bcId}/confirmer")->assertOk();
        $bl = $this->actingAs($lab, 'sanctum')->postJson("/api/v1/bons-commande/{$bcId}/transformer-bl")->json();
        $blId = (int) $bl['id'];
        $blLineId = (int) $bl['lignes'][0]['id'];

        return [$lab, $bcId, $blId, $blLineId, $bcLineId];
    }
}
