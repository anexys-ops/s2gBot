<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Devis {{ $quote->number }}</title>
    <style>
        @page { size: A4 portrait; margin: 12mm 14mm 14mm; }
        body {
            font-family: DejaVu Sans, Arial, Helvetica, sans-serif;
            font-size: 9pt;
            color: #111;
            margin: 0;
            padding: 0;
        }
        table { border-collapse: collapse; }
        .page-break { page-break-after: always; }
    </style>
</head>
<body>
@php
    $NAVY = '#1c3a6e';
    $LGRAY = '#f2f2f2';
    $BORDER = '#c0c0c0';
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ');
    $ctx = $pdfContext ?? [];
    $rows = $itemRows ?? [];
    $currency = $currencyLabel ?? 'DH';
    $signatureName = $layoutConfig['header']['signature_name'] ?? 'S.HAJJAM';
    $signatureTitle = $layoutConfig['header']['signature_title'] ?? 'Chef département Technico-commercial';
    $bankLines = $layoutConfig['footer']['bank_lines'] ?? [
        'BMCE Bank 1 Agence Mohammedia Ville',
        'RIB : 011 787 0000 15 210 00 60 932 28',
    ];
@endphp

{{-- ── Page 1 ── --}}
<div class="page-break">
    @include('pdf.partials.s2g-devis-header', [
        'letterheadDataUri' => $letterheadDataUri ?? null,
        'brandingLogoDataUri' => $brandingLogoDataUri ?? null,
    ])

    <div style="border:1.5px solid {{ $NAVY }};text-align:center;padding:7px 12px;margin-bottom:14px;font-size:13pt;font-weight:bold;">
        Devis N°&nbsp;&nbsp;<span style="color:{{ $NAVY }};">{{ $quote->number }}</span>
    </div>

    <table style="width:100%;margin-bottom:14px;">
        <tr>
            <td style="font-weight:bold;white-space:nowrap;padding:0 8px 5px 0;vertical-align:top;width:1%;">Client :</td>
            <td style="padding-bottom:5px;">{{ $quote->client->name }}</td>
        </tr>
        @if(!empty($ctx['affaire']))
        <tr>
            <td style="font-weight:bold;white-space:nowrap;padding:0 8px 5px 0;vertical-align:top;">Affaire :</td>
            <td style="padding-bottom:5px;">{{ $ctx['affaire'] }}</td>
        </tr>
        @endif
        <tr>
            <td style="font-weight:bold;white-space:nowrap;padding:0 8px 5px 0;vertical-align:top;">Date :</td>
            <td style="padding-bottom:5px;">{{ $quote->quote_date->format('d/m/Y') }}</td>
        </tr>
    </table>

    <table style="width:100%;margin-bottom:10px;">
        <colgroup>
            <col style="width:55%;"/>
            <col style="width:7%;"/>
            <col style="width:10%;"/>
            <col style="width:13%;"/>
            <col style="width:15%;"/>
        </colgroup>
        <thead>
            <tr>
                <th style="padding:5px 6px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;font-weight:bold;text-align:left;">DESIGNATION</th>
                <th style="padding:5px 6px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;font-weight:bold;text-align:center;">Unité</th>
                <th style="padding:5px 6px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;font-weight:bold;text-align:center;">Quantité</th>
                <th style="padding:5px 6px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;font-weight:bold;text-align:center;">PU HT</th>
                <th style="padding:5px 6px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;font-weight:bold;text-align:center;">PT HT</th>
            </tr>
        </thead>
        <tbody>
            @foreach($rows as $row)
                @if(($row['type'] ?? '') === 'jalon_header')
                    <tr>
                        <td colspan="5" style="padding:6px 8px;border:1px solid {{ $BORDER }};background:{{ $LGRAY }};font-weight:bold;font-size:9.5pt;">
                            @if(!empty($row['code']))
                                <span style="color:{{ $NAVY }};">{{ $row['code'] }}</span> —
                            @endif
                            {{ $row['label'] }}
                        </td>
                    </tr>
                @elseif(($row['type'] ?? '') === 'product')
                    <tr>
                        <td style="padding:4px 6px;border:1px solid {{ $BORDER }};background:{{ $LGRAY }};font-weight:bold;">{{ $row['num'] }}. {{ $row['label'] }}</td>
                        <td style="padding:4px 6px;border:1px solid {{ $BORDER }};background:{{ $LGRAY }};font-weight:bold;text-align:center;">{{ $row['unite'] }}</td>
                        <td style="padding:4px 6px;border:1px solid {{ $BORDER }};background:{{ $LGRAY }};font-weight:bold;text-align:center;">{{ $row['qte'] }}</td>
                        <td style="padding:4px 6px;border:1px solid {{ $BORDER }};background:{{ $LGRAY }};font-weight:bold;text-align:right;">
                            @if($row['pu'] !== null){{ $fmt($row['pu']) }}@else—@endif
                        </td>
                        <td style="padding:4px 6px;border:1px solid {{ $BORDER }};background:{{ $LGRAY }};font-weight:bold;text-align:right;">
                            @if($row['pt'] !== null){{ $fmt($row['pt']) }}@else—@endif
                        </td>
                    </tr>
                    @foreach($row['details'] ?? [] as $detail)
                    <tr>
                        <td colspan="5" style="padding:2px 6px 2px 14px;border:1px solid #e0e0e0;font-size:8.5pt;color:#222;">- {{ $detail }}</td>
                    </tr>
                    @endforeach
                @endif
            @endforeach
        </tbody>
    </table>

    @php
        $totalHt = !empty($ctx['is_forfait']) && ($ctx['forfait_ht'] ?? 0) > 0
            ? (float) $ctx['forfait_ht']
            : (float) ($ctx['total_ht'] ?? $quote->amount_ht);
        $totalTva = (float) ($ctx['total_tva'] ?? max(0, $quote->amount_ttc - $quote->amount_ht));
        $totalTtc = (float) ($ctx['total_ttc'] ?? $quote->amount_ttc);
    @endphp

    <table style="width:100%;margin-bottom:14px;">
        <thead>
            <tr>
                <td style="border:1px solid {{ $BORDER }};padding:5px 8px;width:37%;font-weight:bold;text-align:center;">Total</td>
                <th style="border:1px solid {{ $BORDER }};padding:5px 8px;text-align:center;font-weight:bold;background:{{ $LGRAY }};">Total HT</th>
                <th style="border:1px solid {{ $BORDER }};padding:5px 8px;text-align:center;font-weight:bold;background:{{ $LGRAY }};">Total TVA</th>
                <th style="border:1px solid {{ $BORDER }};padding:5px 8px;text-align:center;font-weight:bold;background:{{ $LGRAY }};">Total TTC</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="border:1px solid {{ $BORDER }};padding:5px 8px;">&nbsp;</td>
                <td style="border:1px solid {{ $BORDER }};padding:5px 8px;text-align:center;font-weight:bold;">{{ $fmt($totalHt) }}</td>
                <td style="border:1px solid {{ $BORDER }};padding:5px 8px;text-align:center;font-weight:bold;">{{ $fmt($totalTva) }}</td>
                <td style="border:1px solid {{ $BORDER }};padding:5px 8px;text-align:center;font-weight:bold;">{{ $fmt($totalTtc) }}</td>
            </tr>
        </tbody>
    </table>

    <p style="font-size:8.5pt;margin:0 0 4px;">
        Arrêtée le présent devis à la somme de <strong>{{ $amountInWords ?? '' }}</strong> toute taxe comprise.
    </p>
    <p style="font-size:8.5pt;margin:0 0 12px;">
        <strong>Validité de l'offre :</strong>&nbsp;&nbsp;{{ $ctx['validite_label'] ?? '2 mois à compter de la date d\'envoi de la présente offre' }}
    </p>

    <div style="border:1px solid {{ $BORDER }};border-radius:3px;padding:10px 14px;background:#fafafa;">
        <p style="font-weight:bold;font-size:9.5pt;margin:0 0 8px;">
            BON POUR ACCORD <span style="font-weight:normal;font-size:9pt;">(peut être utilisé en lieu et place d'une commande)</span>
        </p>
        <p style="margin:3px 0;">Nom&nbsp;&nbsp;&nbsp;..............................</p>
        <p style="margin:3px 0;">Visa&nbsp;&nbsp;..............................</p>
        <p style="margin:3px 0 10px;">Fonction ..............................</p>
        <div style="font-size:7pt;color:#333;line-height:1.45;">
            Notre portée d'accréditation est disponible sur le site internet <span style="color:{{ $NAVY }};">www.s2g.ma</span><br/>
            Dans le cas d'une prestation donnant lieu à une décision de conformité, la conformité n'est déclarée que si le résultat de mesure est
            situé à l'intérieur de la zone de tolérance, en incluant ou excluant l'incertitude associée au résultat, ou sauf autre règle citée ou
            référencée dans les conditions particulières communiqués par le client.<br/>
            Le laboratoire informe le client que certaines données techniques le concernant (telles que les rapports d'essais) peuvent être
            communiquées à des tiers dans le cadre des exigences réglementaires, notamment au Ministère de l'Équipement, dans le cadre du
            processus de qualification et de classification des laboratoires BTP. Cette communication est réalisée sans notification préalable,
            tout en garantissant la confidentialité et l'intégrité des données.
        </div>
    </div>
</div>

{{-- ── Page 2 ── --}}
<div>
    @include('pdf.partials.s2g-devis-header', [
        'letterheadDataUri' => $letterheadDataUri ?? null,
        'brandingLogoDataUri' => $brandingLogoDataUri ?? null,
    ])

    <table style="width:100%;border:1px solid {{ $BORDER }};">
        <tr>
            <td style="padding:10px 14px;vertical-align:top;width:50%;border-right:1px solid {{ $BORDER }};">
                <p style="font-weight:bold;margin:0 0 5px;">Conditions de règlement :</p>
                <p style="margin:0;">{{ $ctx['reglement'] ?? '100% PAR CHEQUE A TRENTE JOURS DE FACTURE' }}</p>
            </td>
            <td style="padding:10px 14px;vertical-align:top;">
                <p style="font-weight:bold;margin:0 0 5px;">Coordonnées bancaires :</p>
                <p style="margin:0;">
                    @foreach($bankLines as $i => $line)
                        @if($i > 0)<br/>@endif{{ $line }}
                    @endforeach
                </p>
            </td>
        </tr>
    </table>

    <div style="text-align:center;margin-top:24px;">
        <p style="margin:0 0 4px;">{{ $signatureTitle }}</p>
        <p style="margin:0 0 14px;font-weight:bold;font-size:11pt;">{{ $signatureName }}</p>
        <div style="width:130px;height:65px;border:1px solid {{ $BORDER }};border-radius:3px;margin:0 auto;text-align:center;color:#bbb;font-size:8pt;background:#fafafa;line-height:65px;">
            Cachet / Signature
        </div>
    </div>

    <div style="margin-top:80px;padding-top:10px;border-top:1px solid {{ $NAVY }};text-align:center;font-size:7pt;color:#333;line-height:1.55;">
        <strong>S2G - S.A.R.L. au capital de 12 000 000 DH</strong><br/>
        RC : 3131&nbsp;&nbsp;Patente : 39563875&nbsp;&nbsp;IF : 3303347&nbsp;&nbsp;CNSS : 6189676&nbsp;&nbsp;ICE : 001535880000001<br/>
        Lot N°276, Zone industrielle Sud-ouest – Mohammedia – Maroc<br/>
        Tél : (+212) 5.23.31.50.46&nbsp;&nbsp;|&nbsp;&nbsp;Fax : (+212) 5.23.31.71.49&nbsp;&nbsp;|&nbsp;&nbsp;WhatsApp de réclamation : (+212) 6.61.41.04.23<br/>
        E-mail : contact@s2g.ma&nbsp;&nbsp;|&nbsp;&nbsp;Site web : www.s2g.ma
    </div>
</div>
</body>
</html>
