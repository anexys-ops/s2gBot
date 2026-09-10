<?php

namespace Tests\Unit;

use App\Models\ModuleSetting;
use App\Services\FxRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FxRateServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_same_currency_returns_one(): void
    {
        $service = app(FxRateService::class);

        $this->assertSame(1.0, $service->getRate('MAD', 'MAD'));
    }

    public function test_fallback_rate_from_module_settings(): void
    {
        ModuleSetting::query()->create([
            'module_key' => 'fx_rates',
            'settings' => [
                'enabled' => false,
                'fallback_rates' => [
                    'EUR' => 10.0,
                ],
            ],
        ]);

        $service = app(FxRateService::class);

        $this->assertSame(10.0, $service->getRate('EUR', 'MAD'));
    }
}
