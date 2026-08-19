<?php

namespace Tests\Unit;

use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Client;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Services\QuotePricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuotePricingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_mixed_jalon_forfait_uses_jalon_ht_instead_of_child_lines(): void
    {
        $client = Client::query()->create(['name' => 'Client pricing']);
        $famille = FamilleArticle::query()->create([
            'code' => 'FAM-P',
            'libelle' => 'Famille pricing',
            'actif' => true,
        ]);
        $child = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'ART-P1',
            'libelle' => 'Enfant forfait',
            'unite' => 'U',
            'actif' => true,
            'kind' => Article::KIND_PRODUCT,
        ]);
        $quote = Quote::query()->create([
            'client_id' => $client->id,
            'number' => 'DV-PRICING-1',
            'quote_date' => '2026-06-16',
            'amount_ht' => 0,
            'amount_ttc' => 0,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
            'meta' => [
                'devis_jalons' => [
                    [
                        'id' => 'j-f',
                        'libelle' => 'Lot forfait',
                        'mode' => 'forfait',
                        'montant_ht' => 1500,
                        'tva_rate' => 20,
                        'product_ref_article_ids' => [$child->id],
                    ],
                ],
            ],
        ]);
        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'ref_article_id' => $child->id,
            'description' => 'Enfant forfait',
            'quantity' => 2,
            'unit_price' => 400,
            'tva_rate' => 20,
            'total' => 800,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'description' => 'Ligne libre',
            'quantity' => 1,
            'unit_price' => 100,
            'tva_rate' => 20,
            'total' => 100,
        ]);

        $quote->load('quoteLines');
        $lines = QuotePricingService::totalsLines($quote);

        $this->assertCount(2, $lines);
        $hts = array_column($lines, 'ht');
        sort($hts);
        $this->assertSame([100.0, 1500.0], $hts);
    }
}
