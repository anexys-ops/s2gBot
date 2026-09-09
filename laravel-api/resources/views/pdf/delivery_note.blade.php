<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Bon de livraison {{ $bonLivraison->numero }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; }
        h1 { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
        th { background: #eee; }
        .meta { margin: 5px 0; color: #555; }
        .text-right { text-align: right; }
    </style>
</head>
<body>
@include('pdf.partials.commercial-layout-config', ['layoutConfig' => $layoutConfig ?? []])
@php
    $currencyLabel = $currencyLabel ?? 'DH';
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ');
    $bc = $bonLivraison->bonCommande;
@endphp
    @include('pdf.partials.branding-header', ['layoutConfig' => $layoutConfig ?? [], 'brandingLogoDataUri' => $brandingLogoDataUri ?? null])
    <h1>Bon de livraison n° {{ $bonLivraison->numero }}</h1>
    <p class="meta">Date livraison : {{ $bonLivraison->date_livraison?->format('d/m/Y') ?? '—' }}</p>
    @if($showClientName)
    <p class="meta">Client : {{ $bonLivraison->client?->name ?? '—' }}</p>
    @endif
    @if($bc)
    <p class="meta">Bon de commande : {{ $bc->numero }}</p>
    @endif

    <table>
        <thead>
            <tr>
                @if($showDesignation || $showArticleCode)
                <th>Désignation</th>
                @endif
                @if($showQuantity)
                <th>Qté livrée</th>
                @endif
                @if($showPuPtCols)
                <th>PU HT</th>
                <th class="text-right">Total HT</th>
                @endif
            </tr>
        </thead>
        <tbody>
            @foreach($bonLivraison->lignes as $ligne)
            @php
                $bcLigne = $ligne->bonCommandeLigne;
                $articleCode = trim((string) ($bcLigne?->article?->code ?? $bcLigne?->article?->s2g_code ?? ''));
                $lineParts = [];
                if ($showArticleCode && $articleCode !== '') { $lineParts[] = $articleCode; }
                if ($showDesignation && !empty($ligne->libelle)) { $lineParts[] = $ligne->libelle; }
                $lineLabel = $lineParts !== [] ? implode(' — ', $lineParts) : '—';
            @endphp
            <tr>
                @if($showDesignation || $showArticleCode)
                <td>{{ $lineLabel }}</td>
                @endif
                @if($showQuantity)
                <td>{{ $ligne->quantite_livree ?? '—' }}</td>
                @endif
                @if($showPuPtCols)
                <td>{{ $fmt($bcLigne?->prix_unitaire_ht ?? 0) }} {{ $currencyLabel }}</td>
                <td class="text-right">{{ $fmt(($bcLigne?->prix_unitaire_ht ?? 0) * ($ligne->quantite_livree ?? 0)) }} {{ $currencyLabel }}</td>
                @endif
            </tr>
            @endforeach
        </tbody>
    </table>

    @if($bc && ($showTotalHt || $showTotalTva || $showTotalTtc))
    <div style="margin-top: 20px; text-align: right;">
        @if($showTotalHt)
        <p>Total HT : {{ $fmt($bc->montant_ht ?? 0) }} {{ $currencyLabel }}</p>
        @endif
        @if($showTotalTva)
        @php $tva = max(0, (float) ($bc->montant_ttc ?? 0) - (float) ($bc->montant_ht ?? 0)); @endphp
        <p>TVA : {{ $fmt($tva) }} {{ $currencyLabel }}</p>
        @endif
        @if($showTotalTtc)
        <p><strong>Total TTC : {{ $fmt($bc->montant_ttc ?? 0) }} {{ $currencyLabel }}</strong></p>
        @endif
    </div>
    @endif
</body>
</html>
