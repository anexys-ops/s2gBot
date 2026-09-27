<?php

namespace Tests\Feature;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\Quote;
use App\Models\Site;
use App\Models\User;
use App\Services\BonCommandeTotalsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BonCommandeTotalsTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_repairs_stale_header_totals_from_the_current_lines(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_LAB_ADMIN]);
        $client = Client::query()->create(['name' => 'Client test']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier test']);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2026-0035/HQ',
            'titre' => 'Suivi',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-09-22',
            'created_by' => $user->id,
        ]);
        $quote = Quote::query()->create([
            'number' => 'DEV-2026-0058/HQ',
            'client_id' => $client->id,
            'dossier_id' => $dossier->id,
            'quote_date' => '2026-09-22',
            'amount_ht' => 5080,
            'amount_ttc' => 6096,
            'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED,
            'meta' => [
                'devis_jalons' => [[
                    'id' => 'acier',
                    'libelle' => 'Essais sur aciers',
                    'mode' => 'forfait',
                    'product_ref_article_ids' => [101],
                ]],
            ],
        ]);
        $bonCommande = BonCommande::query()->create([
            'numero' => 'BCC-2026-0037/HQ',
            'quote_id' => $quote->id,
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_CONFIRME,
            'date_commande' => '2026-09-22',
            'montant_ht' => 0,
            'montant_ttc' => 0,
            'created_by' => $user->id,
        ]);
        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bonCommande->id,
            'libelle' => 'Prestation forfaitaire — Essais sur aciers',
            'ordre' => 0,
            'quantite' => 1,
            'prix_unitaire_ht' => 5080,
            'tva_rate' => 20,
            'montant_ht' => 5080,
        ]);
        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bonCommande->id,
            'ref_article_id' => 101,
            'libelle' => 'ANEXYS-TEST-PRODUCT',
            'ordre' => 1,
            'quantite' => 1,
            'prix_unitaire_ht' => 10.04,
            'tva_rate' => 20,
            'montant_ht' => 10.04,
        ]);

        $totals = app(BonCommandeTotalsService::class)->synchronize($bonCommande);

        $this->assertSame(5080.0, $totals['amount_ht']);
        $this->assertSame(6096.0, $totals['amount_ttc']);
        $this->assertDatabaseHas('bons_commande', [
            'id' => $bonCommande->id,
            'montant_ht' => 5080,
            'montant_ttc' => 6096,
        ]);
    }
}
