<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\BonLivraison;
use App\Models\Catalogue\Tache;
use App\Models\Client;
use App\Models\DevisTache;
use App\Models\Dossier;
use App\Models\Invoice;
use App\Models\OrdreMission;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Quote;
use App\Models\Sample;
use App\Models\Site;
use App\Models\TestType;
use App\Models\User;
use App\Services\CommercialDocumentsPurgeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommercialDocumentsPurgeTest extends TestCase
{
    use RefreshDatabase;

    public function test_purge_removes_commercial_documents_but_keeps_dossiers_and_clients(): void
    {
        $client = Client::query()->create(['name' => 'Client Purge']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site Purge']);
        $user = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-PURGE-001',
            'titre' => 'Dossier purge',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-01-01',
            'created_by' => $user->id,
        ]);

        $quote = Quote::query()->create([
            'number' => 'DEV-2026-0001',
            'client_id' => $client->id,
            'quote_date' => '2026-06-01',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'status' => Quote::STATUS_DRAFT,
        ]);

        $bc = BonCommande::query()->create([
            'numero' => 'BC-2026-0001',
            'quote_id' => $quote->id,
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_BROUILLON,
            'date_commande' => '2026-06-02',
            'montant_ht' => 100,
            'montant_ttc' => 120,
            'created_by' => $user->id,
        ]);

        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'libelle' => 'Ligne test',
            'quantite' => 1,
            'prix_unitaire_ht' => 100,
            'montant_ht' => 100,
        ]);

        $bcLine = BonCommandeLigne::query()->where('bon_commande_id', $bc->id)->first();

        BonLivraison::query()->create([
            'numero' => 'BL-2026-0001',
            'bon_commande_id' => $bc->id,
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonLivraison::STATUT_BROUILLON,
            'date_livraison' => '2026-06-03',
            'created_by' => $user->id,
        ]);

        Invoice::query()->create([
            'number' => 'FAC-2026-0001',
            'client_id' => $client->id,
            'invoice_date' => '2026-06-04',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'status' => Invoice::STATUS_DRAFT,
        ]);

        OrdreMission::query()->create([
            'numero' => 'OM-2026-0001',
            'bon_commande_id' => $bc->id,
            'client_id' => $client->id,
            'dossier_id' => $dossier->id,
            'type' => OrdreMission::TYPE_LABO,
            'statut' => OrdreMission::STATUT_BROUILLON,
        ]);

        Sample::query()->create([
            'order_item_id' => $this->legacyOrderItemId($client),
            'reference' => 'FOLD-PURGE-001',
            'fold_number' => 'FOLD-PURGE-001',
            'bon_commande_ligne_id' => $bcLine->id,
            'dossier_id' => $dossier->id,
            'sample_type' => 'sol',
            'status' => Sample::STATUS_RECEPTIONNE,
        ]);

        DevisTache::query()->create([
            'quote_id' => $quote->id,
            'ref_tache_id' => Tache::query()->create([
                'code' => 'T-PURGE-1',
                'libelle' => 'Tâche devis',
            ])->id,
            'libelle' => 'Tâche devis',
            'prix_unitaire_ht' => 50,
            'statut' => DevisTache::STATUT_A_FAIRE,
        ]);

        $dryRunCounts = app(CommercialDocumentsPurgeService::class)->purge(dryRun: true);
        $this->assertGreaterThan(0, $dryRunCounts['quotes']);
        $this->assertDatabaseHas('quotes', ['id' => $quote->id]);

        app(CommercialDocumentsPurgeService::class)->purge(dryRun: false);

        $this->assertDatabaseMissing('quotes', ['id' => $quote->id]);
        $this->assertDatabaseMissing('bons_commande', ['id' => $bc->id]);
        $this->assertDatabaseMissing('bons_livraison', ['numero' => 'BL-2026-0001']);
        $this->assertDatabaseMissing('invoices', ['number' => 'FAC-2026-0001']);
        $this->assertDatabaseMissing('ordres_mission', ['numero' => 'OM-2026-0001']);
        $this->assertDatabaseMissing('samples', ['reference' => 'FOLD-PURGE-001']);
        $this->assertDatabaseMissing('devis_taches', ['quote_id' => $quote->id]);

        $this->assertDatabaseHas('clients', ['id' => $client->id]);
        $this->assertDatabaseHas('dossiers', ['id' => $dossier->id]);
    }

    private function legacyOrderItemId(Client $client): int
    {
        $agency = Agency::query()->create([
            'client_id' => $client->id,
            'name' => 'Siège purge',
            'is_headquarters' => true,
        ]);
        $testType = TestType::query()->create([
            'name' => 'Essai purge',
            'unit_price' => '10.00',
        ]);
        $order = Order::query()->create([
            'reference' => 'ORD-PURGE-'.uniqid(),
            'client_id' => $client->id,
            'agency_id' => $agency->id,
            'status' => Order::STATUS_IN_PROGRESS,
            'order_date' => now()->toDateString(),
        ]);

        return (int) OrderItem::query()->create([
            'order_id' => $order->id,
            'test_type_id' => $testType->id,
            'quantity' => 1,
        ])->id;
    }
}
