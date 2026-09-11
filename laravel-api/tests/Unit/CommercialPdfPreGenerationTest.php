<?php

namespace Tests\Unit;

use App\Models\Client;
use App\Models\DocumentPdfTemplate;
use App\Models\Quote;
use App\Services\CommercialPdfCache;
use App\Services\CommercialPdfPreGenerationService;
use App\Services\QuotePdfGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommercialPdfPreGenerationTest extends TestCase
{
    use RefreshDatabase;

    public function test_warm_quote_generates_cached_pdf_for_default_template(): void
    {
        DocumentPdfTemplate::query()->create([
            'document_type' => 'quote',
            'slug' => 'test-default-'.uniqid(),
            'name' => 'Devis test',
            'blade_view' => 'pdf.quote_detailed',
            'is_default' => true,
            'is_active' => true,
        ]);

        $client = Client::query()->create(['name' => 'Client PDF warm']);
        $quote = Quote::query()->create([
            'client_id' => $client->id,
            'number' => 'DV-WARM-1',
            'quote_date' => '2026-06-16',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'tva_rate' => 20,
            'status' => Quote::STATUS_DRAFT,
        ]);

        $service = app(CommercialPdfPreGenerationService::class);
        $scheduled = $service->warmQuote($quote->fresh());
        $this->assertNotEmpty($scheduled);

        $generator = app(QuotePdfGenerator::class);
        [$firstBytes, ] = $generator->generate($quote->fresh(), $scheduled[0]);
        [$secondBytes, ] = $generator->generate($quote->fresh(), $scheduled[0]);

        $this->assertSame($firstBytes, $secondBytes);
        $this->assertStringStartsWith('%PDF', $firstBytes);
        $this->assertTrue(app(CommercialPdfCache::class) !== null);
    }
}
