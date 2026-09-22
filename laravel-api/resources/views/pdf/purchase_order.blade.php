<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Bon de commande {{ $bonCommande->numero }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; }
        h1 { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
        th { background: #eee; }
        .meta { margin: 5px 0; color: #555; }
        .text-right { text-align: right; }
        .jalon-row { page-break-after: avoid; }
        .jalon-row td { background: #e8edf5; font-weight: bold; }
        .nested-line { padding-left: 18px; }
    </style>
</head>
<body>
@php extract(\App\Support\AppBranding::commercialLayoutViewVars($layoutConfig ?? [])); @endphp
@php
    $currencyLabel = $currencyLabel ?? 'DH';
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ');
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

    <table>
        <thead>
            <tr>
                @if($showDesignation || $showArticleCode)
                <th>Désignation</th>
                @endif
                @if($showQuantity)
                <th>Qté</th>
                @endif
                @if($showPuPtCols)
                <th>PU HT</th>
                <th class="text-right">Total HT</th>
                @endif
            </tr>
        </thead>
        <tbody>
            @foreach($displayRows ?? [] as $row)
            @php
                $isJalon = ($row['type'] ?? '') === 'jalon_header';
                $ligne = $isJalon ? ($row['forfait_ligne'] ?? null) : ($row['ligne'] ?? null);
                $jalonParts = array_filter([$row['code'] ?? null, $row['label'] ?? null]);
                $articleCode = trim((string) ($ligne?->article?->code ?? $ligne?->article?->s2g_code ?? ''));
                $lineParts = [];
                if ($showArticleCode && $articleCode !== '') { $lineParts[] = $articleCode; }
                if ($showDesignation && !empty($ligne?->libelle)) { $lineParts[] = $ligne->libelle; }
                $lineLabel = $isJalon
                    ? ($jalonParts !== [] ? implode(' — ', $jalonParts) : '—')
                    : ($lineParts !== [] ? implode(' — ', $lineParts) : '—');
            @endphp
            <tr class="{{ $isJalon ? 'jalon-row' : '' }}">
                @if($showDesignation || $showArticleCode)
                <td class="{{ !$isJalon && !empty($row['nested']) ? 'nested-line' : '' }}">{{ $lineLabel }}</td>
                @endif
                @if($showQuantity)
                <td>{{ $ligne?->quantite ?? '' }}</td>
                @endif
                @if($showPuPtCols)
                <td>{{ $ligne ? $fmt($ligne->prix_unitaire_ht ?? 0).' '.$currencyLabel : '' }}</td>
                <td class="text-right">{{ $ligne ? $fmt($ligne->montant_ht ?? 0).' '.$currencyLabel : '' }}</td>
                @endif
            </tr>
            @endforeach
        </tbody>
    </table>

    @if($showTotalHt || $showTotalTva || $showTotalTtc)
    <div style="margin-top: 20px; text-align: right;">
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
