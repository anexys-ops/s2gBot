<?php

namespace Tests\Unit;

use App\Models\Client;
use App\Services\DocumentCurrencyService;
use App\Services\FxRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class DocumentCurrencyServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_base_amounts_multiply_by_exchange_rate(): void
    {
        $service = app(DocumentCurrencyService::class);

        $base = $service->baseAmounts(100.0, 120.0, 10.5);

        $this->assertSame(1050.0, $base['amount_ht_base']);
        $this->assertSame(1260.0, $base['amount_ttc_base']);
    }

    public function test_snapshot_for_mad_client(): void
    {
        $client = Client::query()->create(['name' => 'Client MAD', 'currency_code' => 'MAD']);
        $service = app(DocumentCurrencyService::class);

        $snapshot = $service->snapshotForClient($client, '2026-03-01');

        $this->assertSame('MAD', $snapshot['currency_code']);
        $this->assertSame(1.0, $snapshot['exchange_rate']);
    }

    public function test_snapshot_for_foreign_client_uses_fx_service(): void
    {
        $fx = Mockery::mock(FxRateService::class);
        $fx->shouldReceive('getRate')->once()->with('EUR', 'MAD', '2026-03-01')->andReturn(10.85);
        $this->app->instance(FxRateService::class, $fx);

        $client = Client::query()->create(['name' => 'Client EUR', 'currency_code' => 'EUR']);
        $service = app(DocumentCurrencyService::class);

        $snapshot = $service->snapshotForClient($client, '2026-03-01');

        $this->assertSame('EUR', $snapshot['currency_code']);
        $this->assertSame(10.85, $snapshot['exchange_rate']);
    }
}
