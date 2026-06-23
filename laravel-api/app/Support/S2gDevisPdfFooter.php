<?php

namespace App\Support;

use Dompdf\Canvas;
use Dompdf\FontMetrics;

/**
 * Renders the S2G legal footer at the bottom of the last PDF page via DomPDF canvas.
 * CSS absolute/fixed positioning is unreliable in DomPDF for last-page footers.
 */
final class S2gDevisPdfFooter
{
    /** @var array{0: float, 1: float, 2: float} */
    private const NAVY = [0.11, 0.23, 0.43];

    /** @var array{0: float, 1: float, 2: float} */
    private const TEXT = [0.2, 0.2, 0.2];

    public static function render(Canvas $canvas, FontMetrics $fontMetrics): void
    {
        $width = $canvas->get_width();
        $marginSide = self::mmToPt(14);
        $marginBottom = self::mmToPt(14);
        $font = $fontMetrics->getFont('DejaVu Sans');
        $fontBold = $fontMetrics->getFont('DejaVu Sans', 'bold');
        $size = 7;
        $lineHeight = 9;

        /** @var list<array{0: string, 1: bool}> $lines */
        $lines = [
            ['S2G - S.A.R.L. au capital de 12 000 000 DH', true],
            ['RC : 3131  Patente : 39563875  IF : 3303347  CNSS : 6189676  ICE : 001535880000001', false],
            ['Lot N°276, Zone industrielle Sud-ouest – Mohammedia – Maroc', false],
            ['Tél : (+212) 5.23.31.50.46  |  Fax : (+212) 5.23.31.71.49  |  WhatsApp de réclamation : (+212) 6.61.41.04.23', false],
            ['E-mail : contact@s2g.ma  |  Site web : www.s2g.ma', false],
        ];

        $borderY = $marginBottom + (count($lines) * $lineHeight) + 4;
        $canvas->line($marginSide, $borderY, $width - $marginSide, $borderY, self::NAVY, 0.75);

        foreach (array_reverse($lines) as $index => [$text, $bold]) {
            $activeFont = $bold ? $fontBold : $font;
            if ($activeFont === null) {
                continue;
            }
            $textWidth = $fontMetrics->getTextWidth($text, $activeFont, $size);
            $x = ($width - $textWidth) / 2;
            $y = $marginBottom + ($index * $lineHeight);
            $canvas->text($x, $y, $text, $activeFont, $size, self::TEXT);
        }
    }

    private static function mmToPt(float $mm): float
    {
        return $mm / 25.4 * 72;
    }
}
