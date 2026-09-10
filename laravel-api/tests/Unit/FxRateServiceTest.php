<?php

namespace Tests\Unit;

use App\Models\ModuleSetting;
use App\Services\FxRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
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
        ModuleSetting::query()->updateOrCreate(
            ['module_key' => 'fx_rates'],
            [
                'settings' => [
                    'enabled' => false,
                    'fallback_rates' => [
                        'EUR' => 10.0,
                    ],
                ],
            ],
        );

        Cache::flush();
        $service = app(FxRateService::class);

        $this->assertSame(10.0, $service->getRate('EUR', 'MAD'));
    }

    public function test_status_lists_foreign_currencies(): void
    {
        $service = app(FxRateService::class);

        $status = $service->status();

        $this->assertContains('EUR', collect($status['rates'])->pluck('code')->all());
        $this->assertContains('XOF', collect($status['rates'])->pluck('code')->all());
    }

    public function test_refresh_populates_cached_rates(): void
    {
        $defaults = app(FxRateService::class)->settings();
        ModuleSetting::query()->updateOrCreate(
            ['module_key' => 'fx_rates'],
            [
                'settings' => [
                    'enabled' => false,
                    'fallback_rates' => $defaults['fallback_rates'],
                ],
            ],
        );

        Cache::flush();
        $service = app(FxRateService::class);
        $status = $service->refresh();

        $this->assertNotNull($status['last_refresh_at']);
        $eur = collect($status['rates'])->firstWhere('code', 'EUR');
        $this->assertSame(10.85, $eur['rate']);
        $this->assertSame('fallback', $eur['source']);
    }
}
