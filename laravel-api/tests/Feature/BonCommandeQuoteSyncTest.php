<?php

namespace Tests\Feature;

use App\Models\BonCommande;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\Site;
use App\Models\User;
use App\Services\CommercialDocumentWorkflowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Retours client V2 — R4 / R6 : un devis modifié après transformation complète son BC existant. */
class BonCommandeQuoteSyncTest extends TestCase
{
    use RefreshDatabase;

    private User $lab;

    private FamilleArticle $famille;

    public function test_new_detail_of_transferred_jalon_is_added_to_existing_bc_at_jalon_quantity(): void
    {
        [$quote, $articles] = $this->seedQuote([['id' => 'j-cc', 'libelle' => 'Contrôle de compacité', 'mode' => 'forfait', 'quantity' => 30, 'prix_unitaire_ht' => 120, 'refs' => [0, 1, 2]]], 4);
        $bc = $this->workflow()->createBonCommandeFromQuote($quote, $this->lab);
        $this->assertSame(4, $bc->lignes()->count()); // 3 détails + ligne forfait
        $bc->lignes()->where('ref_article_id', $articles[0]->id)->first()->update(['quantite' => 25]);
        $bc->lignes()->where('libelle', 'Prestation forfaitaire — Contrôle de compacité')->first()->update(['quantite' => 25]);

        [$prevJalons, $prevRefs] = $this->snapshot($quote);
        $this->addLine($quote, $articles[3], 80);
        $this->setJalons($quote, [['id' => 'j-cc', 'libelle' => 'Contrôle de compacité', 'mode' => 'forfait', 'quantity' => 30, 'prix_unitaire_ht' => 120, 'product_ref_article_ids' => [$articles[0]->id, $articles[1]->id, $articles[2]->id, $articles[3]->id]]]);

        $added = $this->workflow()->syncBonsCommandeFromQuote($quote->fresh(), $prevJalons, $prevRefs);

        $this->assertSame(1, $added);
        $this->assertDatabaseHas('bons_commande_lignes', [
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $articles[3]->id,
            'quantite' => 25,
            'prix_unitaire_ht' => 80,
        ]);
        // Idempotent.
        $this->assertSame(0, $this->workflow()->syncBonsCommandeFromQuote($quote->fresh(), $prevJalons, $prevRefs));
    }

    public function test_new_jalon_is_added_with_its_forfait_price_but_untransferred_jalon_is_left_alone(): void
    {
        [$quote, $articles] = $this->seedQuote([
            ['id' => 'j-a', 'libelle' => 'Jalon A', 'mode' => 'forfait', 'quantity' => 2, 'prix_unitaire_ht' => 100, 'refs' => [0]],
            ['id' => 'j-b', 'libelle' => 'Jalon B', 'mode' => 'forfait', 'quantity' => 1, 'prix_unitaire_ht' => 50, 'refs' => [1]],
        ], 3);
        // Transfert partiel : seul le jalon A part en BC, B attend un futur BC.
        $bc = $this->workflow()->createBonCommandeFromQuote($quote, $this->lab, false, ['j-a']);

        [$prevJalons, $prevRefs] = $this->snapshot($quote);
        $this->addLine($quote, $articles[2], 40);
        $meta = $quote->meta;
        $meta['devis_jalons'][] = ['id' => 'j-agac', 'libelle' => 'Agrément couche anti-contaminante', 'mode' => 'forfait', 'quantity' => 4, 'prix_unitaire_ht' => 650, 'product_ref_article_ids' => [$articles[2]->id]];
        $quote->update(['meta' => $meta]);

        $this->workflow()->syncBonsCommandeFromQuote($quote->fresh(), $prevJalons, $prevRefs);

        $this->assertDatabaseHas('bons_commande_lignes', [
            'bon_commande_id' => $bc->id,
            'libelle' => 'Prestation forfaitaire — Agrément couche anti-contaminante',
            'quantite' => 4,
            'prix_unitaire_ht' => 650,
        ]);
        $this->assertDatabaseHas('bons_commande_lignes', ['bon_commande_id' => $bc->id, 'ref_article_id' => $articles[2]->id, 'quantite' => 4]);
        $this->assertDatabaseMissing('bons_commande_lignes', ['bon_commande_id' => $bc->id, 'ref_article_id' => $articles[1]->id]);
        $this->assertDatabaseMissing('bons_commande_lignes', ['bon_commande_id' => $bc->id, 'libelle' => 'Prestation forfaitaire — Jalon B']);
    }

    public function test_completer_depuis_devis_endpoint_adds_jalons_absent_from_every_bc(): void
    {
        [$quote, $articles] = $this->seedQuote([
            ['id' => 'j-a', 'libelle' => 'Jalon A', 'mode' => 'forfait', 'quantity' => 2, 'prix_unitaire_ht' => 100, 'refs' => [0]],
            ['id' => 'j-b', 'libelle' => 'Jalon B', 'mode' => 'forfait', 'quantity' => 1, 'prix_unitaire_ht' => 50, 'refs' => [1]],
        ], 2);
        $bc = $this->workflow()->createBonCommandeFromQuote($quote, $this->lab, false, ['j-a']);

        $this->actingAs($this->lab, 'sanctum')
            ->postJson("/api/v1/bons-commande/{$bc->id}/completer-depuis-devis")
            ->assertOk()
            ->assertJsonPath('lignes_ajoutees', 2);
        $this->assertDatabaseHas('bons_commande_lignes', ['bon_commande_id' => $bc->id, 'libelle' => 'Prestation forfaitaire — Jalon B', 'prix_unitaire_ht' => 50]);
    }

    public function test_sync_prix_devis_matches_lines_by_article_not_position(): void
    {
        [$quote, $articles] = $this->seedQuote([], 2);
        $bc = $this->workflow()->createBonCommandeFromQuote($quote, $this->lab);
        $bc->lignes()->update(['prix_unitaire_ht' => 1]);
        // Ligne insérée en tête : un appariement par index décalerait tous les prix.
        $bc->lignes()->create(['libelle' => 'Ligne libre', 'ordre' => -1, 'quantite' => 1, 'prix_unitaire_ht' => 7, 'tva_rate' => 20, 'montant_ht' => 7]);

        $this->actingAs($this->lab, 'sanctum')->postJson("/api/v1/bons-commande/{$bc->id}/sync-prix-devis")->assertOk();

        $this->assertDatabaseHas('bons_commande_lignes', ['bon_commande_id' => $bc->id, 'ref_article_id' => $articles[0]->id, 'prix_unitaire_ht' => 10]);
        $this->assertDatabaseHas('bons_commande_lignes', ['bon_commande_id' => $bc->id, 'ref_article_id' => $articles[1]->id, 'prix_unitaire_ht' => 20]);
        $this->assertDatabaseHas('bons_commande_lignes', ['bon_commande_id' => $bc->id, 'libelle' => 'Ligne libre', 'prix_unitaire_ht' => 7]);
    }

    private function workflow(): CommercialDocumentWorkflowService
    {
        return app(CommercialDocumentWorkflowService::class);
    }

    /** @return array{0: list<string>, 1: list<int>} */
    private function snapshot(Quote $quote): array
    {
        $quote = $quote->fresh('quoteLines');

        return [
            array_map(fn ($j) => (string) $j['id'], $quote->meta['devis_jalons'] ?? []),
            $quote->quoteLines->pluck('ref_article_id')->filter()->map(fn ($id) => (int) $id)->values()->all(),
        ];
    }

    private function addLine(Quote $quote, Article $article, float $price): void
    {
        QuoteLine::query()->create([
            'quote_id' => $quote->id, 'ref_article_id' => $article->id, 'description' => $article->libelle,
            'quantity' => 1, 'unit_price' => $price, 'tva_rate' => 20, 'total' => $price,
        ]);
    }

    /** @param list<array<string, mixed>> $jalons */
    private function setJalons(Quote $quote, array $jalons): void
    {
        $meta = $quote->fresh()->meta;
        $meta['devis_jalons'] = $jalons;
        $quote->update(['meta' => $meta]);
    }

    /**
     * Devis signé avec $articleCount articles ; les $articleCount premiers sont des lignes du devis
     * sauf ceux réservés à un ajout ultérieur (non référencés dans un jalon et hors des 2 premiers).
     *
     * @param  list<array<string, mixed>>  $jalons  'refs' = index d'articles
     * @return array{0: Quote, 1: list<Article>}
     */
    private function seedQuote(array $jalons, int $articleCount): array
    {
        $client = Client::query()->create(['name' => 'Client sync']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier sync']);
        $this->lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-SYNC', 'titre' => 'Dossier', 'client_id' => $client->id, 'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS, 'date_debut' => '2026-09-01', 'created_by' => $this->lab->id,
        ]);
        $this->famille = FamilleArticle::query()->create(['code' => 'SYNC', 'libelle' => 'Sync', 'ordre' => 1, 'actif' => true]);
        $articles = [];
        for ($i = 0; $i < $articleCount; $i++) {
            $articles[] = Article::query()->create([
                'ref_famille_article_id' => $this->famille->id, 'code' => 'SYNC-'.$i, 'libelle' => 'Produit '.$i,
                'kind' => Article::KIND_PRODUCT, 'actif' => true, 'prix_unitaire_ht' => 10 * ($i + 1), 'tva_rate' => 20,
            ]);
        }
        $metaJalons = [];
        $usedIdx = [];
        foreach ($jalons as $j) {
            $refs = array_map(fn (int $idx) => $articles[$idx]->id, $j['refs']);
            array_push($usedIdx, ...$j['refs']);
            unset($j['refs']);
            $metaJalons[] = $j + ['product_ref_article_ids' => $refs];
        }
        $quote = Quote::query()->create([
            'number' => 'DEV-SYNC', 'client_id' => $client->id, 'site_id' => $site->id, 'dossier_id' => $dossier->id,
            'quote_date' => '2026-09-01', 'amount_ht' => 100, 'amount_ttc' => 120, 'tva_rate' => 20,
            'status' => Quote::STATUS_SIGNED, 'meta' => ['devis_jalons' => $metaJalons],
        ]);
        // Lignes du devis : articles des jalons, ou les deux premiers sans jalon.
        $lineIdx = $jalons === [] ? [0, 1] : array_values(array_unique($usedIdx));
        foreach ($lineIdx as $idx) {
            $this->addLine($quote, $articles[$idx], 10 * ($idx + 1));
        }

        return [$quote->fresh(), $articles];
    }
}
