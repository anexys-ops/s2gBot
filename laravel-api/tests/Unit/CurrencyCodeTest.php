<?php

namespace Tests\Unit;

use App\Models\ModuleSetting;
use App\Support\CurrencyCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CurrencyCodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_core_catalog_includes_xof(): void
    {
        $this->assertTrue(CurrencyCode::isSupported('XOF'));
        $this->assertSame('FCFA', CurrencyCode::displayLabel('XOF'));
    }

    public function test_extra_currencies_from_module_settings_are_merged(): void
    {
        ModuleSetting::query()->updateOrCreate(
            ['module_key' => 'fx_rates'],
            [
                'settings' => [
                    'extra_currencies' => [
                        ['code' => 'GNF', 'label' => 'GNF', 'name' => 'Franc guinéen'],
                    ],
                ],
            ],
        );

        $this->assertTrue(CurrencyCode::isSupported('GNF'));
        $this->assertSame('Franc guinéen', CurrencyCode::displayName('GNF'));
    }
}
