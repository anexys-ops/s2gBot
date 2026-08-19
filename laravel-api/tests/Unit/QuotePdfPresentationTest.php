<?php

namespace Tests\Unit;

use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
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
        $famille = FamilleArticle::query()->create([
            'code' => 'FAM-PDF',
            'libelle' => 'Famille PDF',
            'actif' => true,
        ]);
        $child = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'ART-1',
            'libelle' => 'Contrôle de béton',
            'description_commerciale' => "Déplacement de technicien\nDescription commerciale\nEssai d'affaissement",
            'unite' => 'U',
            'actif' => true,
            'kind' => Article::KIND_PRODUCT,
        ]);
        $standalone = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
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

    public function test_forfait_pdf_rows_hide_line_prices_and_prepend_total(): void
    {
        $client = Client::query()->create(['name' => 'Client forfait']);
        $famille = FamilleArticle::query()->create([
            'code' => 'FAM-F',
            'libelle' => 'Famille forfait',
            'actif' => true,
        ]);
        $child = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'ART-F1',
            'libelle' => 'Contrôle forfait',
            'unite' => 'U',
            'actif' => true,
            'kind' => Article::KIND_PRODUCT,
        ]);

        $quote = Quote::query()->create([
            'client_id' => $client->id,
            'number' => 'DV-FORFAIT-1',
            'quote_date' => '2026-06-16',
            'amount_ht' => 1500,
            'amount_ttc' => 1800,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
            'meta' => [
                'mode_devis' => 'forfait',
                'tarif_global_hors_lignes_ht' => 1500,
                'devis_jalons' => [
                    [
                        'id' => 'j1',
                        'libelle' => 'Lot forfait',
                        's2g_code' => 'J-F',
                        'product_ref_article_ids' => [$child->id],
                    ],
                ],
                'devis_parcours' => [
                    ['kind' => 'jalon', 'id' => 'j1'],
                    ['kind' => 'ligne', 'id' => 'child-key'],
                ],
            ],
        ]);

        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'ref_article_id' => $child->id,
            'description' => 'Contrôle forfait',
            'quantity' => 1,
            'unit_price' => 1500,
            'total' => 1500,
        ]);

        $quote->load('quoteLines.refArticle');
        $rows = (new QuotePdfPresentationService)->buildItemRows($quote);

        $this->assertSame('forfait_total', $rows[0]['type']);
        $this->assertSame('F', $rows[0]['unite']);
        $this->assertSame(1, $rows[0]['qte']);
        $this->assertSame(1500.0, $rows[0]['pu']);
        $this->assertSame(1500.0, $rows[0]['pt']);
        $this->assertSame('jalon_header', $rows[1]['type']);
        $this->assertSame('product', $rows[2]['type']);
        $this->assertSame('', $rows[2]['unite']);
        $this->assertNull($rows[2]['qte']);
        $this->assertNull($rows[2]['pu']);
        $this->assertNull($rows[2]['pt']);
    }

    public function test_forfait_pdf_total_prefers_meta_tarif(): void
    {
        $client = Client::query()->create(['name' => 'Client forfait meta']);
        $quote = Quote::query()->create([
            'client_id' => $client->id,
            'number' => 'DV-FORFAIT-2',
            'quote_date' => '2026-06-16',
            'amount_ht' => 2500,
            'amount_ttc' => 3000,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
            'meta' => [
                'mode_devis' => 'forfait',
                'tarif_global_hors_lignes_ht' => 2500,
            ],
        ]);
        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'description' => 'A',
            'quantity' => 1,
            'unit_price' => 400,
            'total' => 400,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'description' => 'B',
            'quantity' => 1,
            'unit_price' => 600,
            'total' => 600,
        ]);

        $quote->load('quoteLines.refArticle');
        $rows = (new QuotePdfPresentationService)->buildItemRows($quote);
        $this->assertSame('forfait_total', $rows[0]['type']);
        $this->assertSame(2500.0, $rows[0]['pu']);
        $this->assertSame(2500.0, $rows[0]['pt']);
    }

    public function test_mixed_jalon_forfait_hides_child_prices_and_inserts_forfait_row(): void
    {
        $client = Client::query()->create(['name' => 'Client mixte']);
        $famille = FamilleArticle::query()->create([
            'code' => 'FAM-M',
            'libelle' => 'Famille mixte',
            'actif' => true,
        ]);
        $forfaitChild = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'ART-MF',
            'libelle' => 'Article forfait jalon',
            'unite' => 'U',
            'actif' => true,
            'kind' => Article::KIND_PRODUCT,
        ]);
        $detailChild = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'ART-MD',
            'libelle' => 'Article détaillé jalon',
            'unite' => 'U',
            'actif' => true,
            'kind' => Article::KIND_PRODUCT,
        ]);

        $quote = Quote::query()->create([
            'client_id' => $client->id,
            'number' => 'DV-MIXTE-1',
            'quote_date' => '2026-06-16',
            'amount_ht' => 1900,
            'amount_ttc' => 2280,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
            'meta' => [
                'devis_jalons' => [
                    [
                        'id' => 'j-f',
                        'libelle' => 'Lot forfait',
                        's2g_code' => 'J-F',
                        'mode' => 'forfait',
                        'montant_ht' => 1500,
                        'product_ref_article_ids' => [$forfaitChild->id],
                    ],
                    [
                        'id' => 'j-d',
                        'libelle' => 'Lot détaillé',
                        's2g_code' => 'J-D',
                        'product_ref_article_ids' => [$detailChild->id],
                    ],
                ],
                'devis_parcours' => [
                    ['kind' => 'jalon', 'id' => 'j-f'],
                    ['kind' => 'jalon', 'id' => 'j-d'],
                ],
            ],
        ]);

        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'ref_article_id' => $forfaitChild->id,
            'description' => 'Article forfait jalon',
            'quantity' => 2,
            'unit_price' => 400,
            'total' => 800,
        ]);
        QuoteLine::query()->create([
            'quote_id' => $quote->id,
            'ref_article_id' => $detailChild->id,
            'description' => 'Article détaillé jalon',
            'quantity' => 2,
            'unit_price' => 200,
            'total' => 400,
        ]);

        $quote->load('quoteLines.refArticle');
        $rows = (new QuotePdfPresentationService)->buildItemRows($quote);

        $this->assertSame('jalon_header', $rows[0]['type']);
        $this->assertTrue($rows[0]['is_forfait']);
        $this->assertSame('forfait_total', $rows[1]['type']);
        $this->assertSame(1500.0, $rows[1]['pt']);
        $this->assertSame('product', $rows[2]['type']);
        $this->assertNull($rows[2]['pu']);
        $this->assertNull($rows[2]['pt']);
        $this->assertSame('jalon_header', $rows[3]['type']);
        $this->assertFalse($rows[3]['is_forfait']);
        $this->assertSame('product', $rows[4]['type']);
        $this->assertSame(200.0, $rows[4]['pu']);
        $this->assertSame(400.0, $rows[4]['pt']);
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

        $this->assertEqualsWithDelta(161.04, $ctx['total_ht'], 0.001);
        $this->assertEqualsWithDelta(32.21, $ctx['total_tva'], 0.001);
        $this->assertEqualsWithDelta(39.6, $ctx['frais_supplementaires_ttc'], 0.001);
        $this->assertEqualsWithDelta(232.85, $ctx['total_ttc'], 0.001);
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
