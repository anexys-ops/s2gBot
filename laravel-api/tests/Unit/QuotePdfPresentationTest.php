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

    public function test_build_item_rows_orders_jalon_children_then_standalone_products(): void
    {
        $client = Client::query()->create(['name' => 'JET-CONTRACTORS']);
        $child = Article::query()->create([
            'code' => 'ART-1',
            'libelle' => 'Contrôle de béton',
            'description_commerciale' => "Déplacement de technicien\nDescription commerciale\nEssai d'affaissement",
            'unite' => 'U',
            'actif' => true,
            'kind' => Article::KIND_PRODUCT,
        ]);
        $standalone = Article::query()->create([
            'code' => 'ART-2',
            'libelle' => 'Essai proctor',
            'description_commerciale' => 'Description commerciale',
            'unite' => 'U',
            'actif' => true,
            'kind' => Article::KIND_PRODUCT,
        ]);

        $quote = Quote::query()->create([
            'client_id' => $client->id,
            'number' => 'DV0948/MO-26',
            'quote_date' => '2026-06-16',
            'amount_ht' => 2000,
            'amount_ttc' => 2400,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
            'meta' => [
                'devis_jalons' => [
                    [
                        'id' => 'j1',
                        'libelle' => 'Lot essais',
                        's2g_code' => 'J-01',
                        'product_ref_article_ids' => [$child->id],
                    ],
                ],
                'devis_parcours' => [
                    ['kind' => 'jalon', 'id' => 'j1'],
                    ['kind' => 'ligne', 'id' => 'child-key'],
                    ['kind' => 'ligne', 'id' => 'standalone-key'],
                ],
            ],
        ]);

        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'ref_article_id' => $child->id,
            'description' => 'Contrôle de béton',
            'quantity' => 2,
            'unit_price' => 700,
            'total' => 1400,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'ref_article_id' => $standalone->id,
            'description' => 'Essai proctor',
            'quantity' => 3,
            'unit_price' => 200,
            'total' => 600,
        ]);

        $quote->load('quoteLines.refArticle');
        $service = new QuotePdfPresentationService;
        $rows = $service->buildItemRows($quote);

        $this->assertCount(3, $rows);
        $this->assertSame('jalon_header', $rows[0]['type']);
        $this->assertSame('Lot essais', $rows[0]['label']);
        $this->assertSame('product', $rows[1]['type']);
        $this->assertTrue($rows[1]['nested']);
        $this->assertSame('1', $rows[1]['num']);
        $this->assertSame('Contrôle de béton', $rows[1]['label']);
        $this->assertCount(2, $rows[1]['details']);
        $this->assertSame('product', $rows[2]['type']);
        $this->assertFalse($rows[2]['nested']);
        $this->assertSame('2', $rows[2]['num']);
        $this->assertSame('Essai proctor', $rows[2]['label']);
        $this->assertSame([], $rows[2]['details']);
    }

    public function test_build_context_includes_frais_supplementaires_in_total_ttc(): void
    {
        $client = Client::query()->create(['name' => 'Client frais']);
        $quote = Quote::query()->create([
            'client_id' => $client->id,
            'number' => 'DV-FS-1',
            'quote_date' => '2026-06-16',
            'amount_ht' => 161.04,
            'amount_ttc' => 193.25,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
            'meta' => [
                'frais_supplementaires' => [
                    [
                        'description' => 'Déplacement',
                        'montant_ht' => 33,
                        'tva_rate' => 20,
                    ],
                ],
            ],
        ]);

        $ctx = (new QuotePdfPresentationService)->buildContext($quote);

        $this->assertSame(161.04, $ctx['total_ht']);
        $this->assertSame(32.21, $ctx['total_tva']);
        $this->assertSame(39.6, $ctx['frais_supplementaires_ttc']);
        $this->assertSame(232.85, $ctx['total_ttc']);
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
