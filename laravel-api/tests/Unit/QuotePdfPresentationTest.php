<?php

namespace Tests\Unit;

use App\Models\Catalogue\Article;
use App\Models\Client;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Services\QuotePdfPresentationService;
use App\Support\FrenchAmountInWords;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuotePdfPresentationTest extends TestCase
{
    use RefreshDatabase;

    public function test_french_amount_in_words_for_sample_total(): void
    {
        $words = FrenchAmountInWords::format(28548);
        $this->assertStringContainsString('vingt-huit', strtolower($words));
        $this->assertStringContainsString('DIRHAMS', $words);
    }

    public function test_build_item_rows_groups_jalon_products(): void
    {
        $client = Client::query()->create(['name' => 'JET-CONTRACTORS']);
        $article = Article::query()->create([
            'code' => 'ART-1',
            'libelle' => 'Contrôle de béton',
            'description_commerciale' => "Déplacement de technicien\nEssai d'affaissement",
            'unite' => 'U',
            'actif' => true,
            'kind' => Article::KIND_PRODUCT,
        ]);

        $quote = Quote::query()->create([
            'client_id' => $client->id,
            'number' => 'DV0948/MO-26',
            'quote_date' => '2026-06-16',
            'amount_ht' => 1400,
            'amount_ttc' => 1680,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
            'meta' => [
                'devis_jalons' => [
                    [
                        'id' => 'j1',
                        'libelle' => 'Lot essais',
                        's2g_code' => 'J-01',
                        'product_ref_article_ids' => [$article->id],
                    ],
                ],
            ],
        ]);

        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'ref_article_id' => $article->id,
            'description' => 'Contrôle de béton',
            'quantity' => 2,
            'unit_price' => 700,
            'total' => 1400,
        ]);

        $quote->load('quoteLines.refArticle');
        $service = new QuotePdfPresentationService;
        $rows = $service->buildItemRows($quote);

        $this->assertSame('jalon_header', $rows[0]['type']);
        $this->assertSame('Lot essais', $rows[0]['label']);
        $this->assertSame('product', $rows[1]['type']);
        $this->assertSame('1', $rows[1]['num']);
        $this->assertCount(2, $rows[1]['details']);
    }

    public function test_quote_pdf_generator_renders_s2g_template(): void
    {
        $client = Client::query()->create(['name' => 'Client PDF']);
        $quote = Quote::query()->create([
            'client_id' => $client->id,
            'number' => 'DV-TEST-1',
            'quote_date' => '2026-06-16',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'description' => 'Prestation test',
            'quantity' => 1,
            'unit_price' => 100,
            'total' => 100,
        ]);

        $generator = app(\App\Services\QuotePdfGenerator::class);
        [$binary, $filename] = $generator->generate($quote->fresh());

        $this->assertStringStartsWith('%PDF', $binary);
        $this->assertSame('devis-DV-TEST-1.pdf', $filename);
    }
}
