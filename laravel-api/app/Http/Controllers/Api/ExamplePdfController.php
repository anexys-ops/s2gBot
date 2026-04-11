<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * PDF d'exemple pédagogiques (courbes d'essais BTP) — téléchargeables par tout utilisateur connecté.
 */
class ExamplePdfController extends Controller
{
    private const COMPRESSION_POINTS = [
        ['t' => 0, 'sigma' => 0.0],
        ['t' => 1, 'sigma' => 8.2],
        ['t' => 2, 'sigma' => 16.5],
        ['t' => 3, 'sigma' => 24.1],
        ['t' => 4, 'sigma' => 30.8],
        ['t' => 5, 'sigma' => 35.2],
        ['t' => 6, 'sigma' => 37.9],
        ['t' => 7, 'sigma' => 39.1],
        ['t' => 8, 'sigma' => 39.6],
    ];

    private const GRANULO_POINTS = [
        ['tamis' => 'D 16 mm', 'passant' => 100.0],
        ['tamis' => 'D 8 mm', 'passant' => 92.0],
        ['tamis' => 'D 4 mm', 'passant' => 78.0],
        ['tamis' => '2 mm', 'passant' => 58.0],
        ['tamis' => '1 mm', 'passant' => 38.0],
        ['tamis' => '0,5 mm', 'passant' => 22.0],
        ['tamis' => '0,25 mm', 'passant' => 12.0],
        ['tamis' => '0,125 mm', 'passant' => 5.0],
        ['tamis' => '0,063 mm', 'passant' => 1.5],
    ];

    public function download(Request $request, string $slug): StreamedResponse|\Illuminate\Http\JsonResponse
    {
        $allowed = ['compression', 'granulometrie', 'synthese-essais'];
        if (! in_array($slug, $allowed, true)) {
            return response()->json(['message' => 'Exemple inconnu'], 404);
        }

        $titles = [
            'compression' => 'Exemple — Courbe contrainte-déformation (béton, schéma pédagogique)',
            'granulometrie' => 'Exemple — Courbe granulométrique (refus cumulés / passants)',
            'synthese-essais' => 'Exemple — Synthèse résultats laboratoire BTP',
        ];

        $data = match ($slug) {
            'compression' => [
                'title' => $titles[$slug],
                'points' => self::COMPRESSION_POINTS,
            ],
            'granulometrie' => [
                'title' => $titles[$slug],
                'points' => self::GRANULO_POINTS,
            ],
            'synthese-essais' => [
                'title' => $titles[$slug],
                'lignes' => [
                    ['essai' => 'Compression béton C25/30', 'norme' => 'NF EN 12390-3', 'resultat' => 'Rc = 38,2 MPa', 'conformite' => 'Conforme'],
                    ['essai' => 'Module de finesse', 'norme' => 'NF EN 933-1', 'resultat' => 'MF = 3,25', 'conformite' => 'Conforme'],
                    ['essai' => 'Teneur en eau', 'norme' => 'NF EN ISO 17892-1', 'resultat' => 'W = 14,8 %', 'conformite' => 'Conforme'],
                    ['essai' => 'CBR à 2,5 mm', 'norme' => 'NF EN 13286-47', 'resultat' => 'CBR = 42 %', 'conformite' => 'Conforme'],
                ],
            ],
            default => [],
        };

        $view = match ($slug) {
            'compression' => 'pdf.examples.compression',
            'granulometrie' => 'pdf.examples.granulometrie',
            default => 'pdf.examples.synthese',
        };

        $html = view($view, $data)->render();
        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');
        $filename = 'exemple-'.$slug.'.pdf';

        return response()->streamDownload(
            fn () => print($pdf->output()),
            $filename,
            ['Content-Type' => 'application/pdf']
        );
    }
}
