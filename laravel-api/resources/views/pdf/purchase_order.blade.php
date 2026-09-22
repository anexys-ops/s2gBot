<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Bon de commande {{ $bonCommande->numero }}</title>
    <style>
        @page { size: A4 portrait; margin: 12mm 14mm 14mm; }
        body { font-family: DejaVu Sans, Arial, Helvetica, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 0; }
        h1 { font-size: 15pt; margin: 0 0 10px; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        .meta { margin: 4px 0; color: #555; }
        .text-right { text-align: right; }
        .items-table { margin-top: 12px; table-layout: fixed; }
        .items-table__jalon { page-break-after: avoid; }
        .items-table__detail { page-break-before: avoid; }
        .totals { margin-top: 14px; page-break-inside: avoid; }
    </style>
</head>
<body>
@php extract(\App\Support\AppBranding::commercialLayoutViewVars($layoutConfig ?? [])); @endphp
@php
    $currencyLabel = $currencyLabel ?? 'DH';
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ');
    $NAVY = '#1c3a6e';
    $LGRAY = '#f2f2f2';
    $BORDER = '#c0c0c0';
    $rows = $itemRows ?? [];
@endphp
    @include('pdf.partials.branding-header', ['layoutConfig' => $layoutConfig ?? [], 'brandingLogoDataUri' => $brandingLogoDataUri ?? null])
    <h1>Bon de commande n° {{ $bonCommande->numero }}</h1>
    <p class="meta">Date : {{ $bonCommande->date_commande?->format('d/m/Y') ?? '—' }}</p>
    @if($showClientName)
    <p class="meta">Client : {{ $bonCommande->client?->name ?? '—' }}</p>
    @endif
    @if($showDossierReference && $bonCommande->dossier)
    <p class="meta">Dossier : {{ $bonCommande->dossier->reference ?? '' }} — {{ $bonCommande->dossier->titre ?? '' }}</p>
    @endif
    @if($showLinkedQuote && $bonCommande->quote)
    <p class="meta">Devis : {{ $bonCommande->quote->number }}</p>
    @endif

    @php
        $colCount = ($showDesignation || $showArticleCode ? 1 : 0) + ($showUnit ? 1 : 0) + ($showQuantity ? 1 : 0) + ($showPuPtCols ? 2 : 0);
        if ($colCount < 1) { $colCount = 1; }
    @endphp
    <table class="items-table">
        <thead>
            <tr>
                @if($showDesignation || $showArticleCode)
                <th style="width:52%;padding:5px 6px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;text-align:left;">DÉSIGNATION</th>
                @endif
                @if($showUnit)
                <th style="width:9%;padding:5px 4px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;text-align:center;">Unité</th>
                @endif
                @if($showQuantity)
                <th style="width:10%;padding:5px 4px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;text-align:center;">Quantité</th>
                @endif
                @if($showPuPtCols)
                <th style="width:14%;padding:5px 4px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;text-align:center;">PU HT</th>
                <th style="width:15%;padding:5px 4px;border:1px solid {{ $BORDER }};background:{{ $NAVY }};color:#fff;text-align:center;">PT HT</th>
                @endif
            </tr>
        </thead>
        <tbody>
            @foreach($rows as $row)
                @if(($row['type'] ?? '') === 'jalon_header')
                    @php
                        $jalonParts = [];
                        if ($showArticleCode && !empty($row['code'])) { $jalonParts[] = $row['code']; }
                        if ($showDesignation && !empty($row['label'])) { $jalonParts[] = $row['label']; }
                        $jalonText = $jalonParts !== [] ? implode(' — ', $jalonParts) : '—';
                    @endphp
                    <tr class="items-table__jalon">
                        <td colspan="{{ $colCount }}" style="padding:5px 8px;border:1px solid {{ $BORDER }};background:{{ $LGRAY }};font-weight:bold;color:{{ $NAVY }};font-size:9.5pt;">
                            {{ $jalonText }}
                        </td>
                    </tr>
                @elseif(in_array(($row['type'] ?? ''), ['product', 'forfait_total'], true))
                    @php
                        $isForfaitTotal = ($row['type'] ?? '') === 'forfait_total';
                        $nested = !empty($row['nested']) && !$isForfaitTotal;
                        $rowBg = $isForfaitTotal ? $LGRAY : '#ffffff';
                        $labelWeight = $isForfaitTotal ? 'bold' : 'normal';
                        $labelPad = $nested ? 'padding:4px 6px 4px 22px;' : 'padding:4px 6px;';
                        $detailPad = $nested ? 'padding:2px 6px 2px 28px;' : 'padding:2px 6px 2px 14px;';
                        $lineParts = [];
                        if ($showArticleCode && !empty($row['code']) && !$isForfaitTotal) { $lineParts[] = $row['code']; }
                        if ($showDesignation && !empty($row['label'])) { $lineParts[] = $row['label']; }
                        $lineLabel = $lineParts !== [] ? implode(' — ', $lineParts) : '—';
                    @endphp
                    <tr>
                        @if($showDesignation || $showArticleCode)
                        <td style="{{ $labelPad }}border:1px solid {{ $BORDER }};background:{{ $rowBg }};font-weight:{{ $labelWeight }};">{{ $lineLabel }}</td>
                        @endif
                        @if($showUnit)
                        <td style="padding:4px;border:1px solid {{ $BORDER }};background:{{ $rowBg }};font-weight:{{ $labelWeight }};text-align:center;">{{ $row['unite'] ?? '' }}</td>
                        @endif
                        @if($showQuantity)
                        <td style="padding:4px;border:1px solid {{ $BORDER }};background:{{ $rowBg }};font-weight:{{ $labelWeight }};text-align:center;">
                            @if($row['qte'] !== null && $row['qte'] !== ''){{ $row['qte'] }}@endif
                        </td>
                        @endif
                        @if($showPuPtCols)
                        <td style="padding:4px;border:1px solid {{ $BORDER }};background:{{ $rowBg }};font-weight:{{ $labelWeight }};text-align:right;white-space:nowrap;">
                            @if($row['pu'] !== null){{ $fmt($row['pu']) }}@endif
                        </td>
                        <td style="padding:4px;border:1px solid {{ $BORDER }};background:{{ $rowBg }};font-weight:{{ $labelWeight }};text-align:right;white-space:nowrap;">
                            @if($row['pt'] !== null){{ $fmt($row['pt']) }}@endif
                        </td>
                        @endif
                    </tr>
                    @if($showLineDetails)
                    @foreach($row['details'] ?? [] as $detail)
                    <tr class="items-table__detail">
                        <td colspan="{{ $colCount }}" style="{{ $detailPad }}border:1px solid #e0e0e0;font-size:8.5pt;color:#222;">- {{ $detail }}</td>
                    </tr>
                    @endforeach
                    @endif
                @endif
            @endforeach
        </tbody>
    </table>

    @if($showTotalHt || $showTotalTva || $showTotalTtc)
    <div class="totals" style="text-align: right;">
        @if($showTotalHt)
        <p>Total HT : {{ $fmt($bonCommande->montant_ht ?? 0) }} {{ $currencyLabel }}</p>
        @endif
        @if($showTotalTva)
        @php $tva = max(0, (float) ($bonCommande->montant_ttc ?? 0) - (float) ($bonCommande->montant_ht ?? 0)); @endphp
        <p>TVA : {{ $fmt($tva) }} {{ $currencyLabel }}</p>
        @endif
        @if($showTotalTtc)
        <p><strong>Total TTC : {{ $fmt($bonCommande->montant_ttc ?? 0) }} {{ $currencyLabel }}</strong></p>
        @endif
    </div>
    @endif
</body>
</html>
