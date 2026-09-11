<?php

namespace Tests\Unit;

use App\Services\CommercialDocumentTotalsService;
use PHPUnit\Framework\TestCase;

class CommercialDocumentTotalsServiceTest extends TestCase
{
    public function test_standard_tva_at_twenty_percent(): void
    {
        $totals = CommercialDocumentTotalsService::computeTotals(
            [['ht' => 100.0, 'tva_rate' => 20.0]],
            0,
            0,
            0,
            20,
        );

        $this->assertSame(100.0, $totals['amount_ht']);
        $this->assertSame(20.0, $totals['amount_tva']);
        $this->assertSame(120.0, $totals['amount_ttc']);
        $this->assertFalse($totals['ca_annuel_tva_regime']);
    }

    public function test_ca_annuel_tva_regime_applies_seventy_five_percent_to_state(): void
    {
        $totals = CommercialDocumentTotalsService::computeTotals(
            [['ht' => 100.0, 'tva_rate' => 20.0]],
            0,
            0,
            0,
            20,
            0,
            20,
            true,
        );

        $this->assertSame(100.0, $totals['amount_ht']);
        $this->assertSame(20.0, $totals['tva_nominale']);
        $this->assertSame(5.0, $totals['tva_recuperable']);
        $this->assertSame(15.0, $totals['amount_tva']);
        $this->assertSame(15.0, $totals['tva_etat']);
        $this->assertSame(115.0, $totals['amount_ttc']);
        $this->assertTrue($totals['ca_annuel_tva_regime']);
    }
}
