<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Facture {{ $invoice->number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; }
        h1 { font-size: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #333; padding: 5px; text-align: left; }
        th { background: #eee; }
        .header { margin-bottom: 16px; }
        .meta { margin: 4px 0; color: #555; }
        .totals { margin-top: 14px; text-align: right; }
        .text-right { text-align: right; }
        .muted { color: #666; font-size: 9px; }
    </style>
</head>
<body>
@php
    $linesCfg = is_array($layoutConfig['lines'] ?? null) ? $layoutConfig['lines'] : [];
    $showLinePrices = ($linesCfg['show_prices'] ?? true) !== false;
    $showPuPtCols = $showLinePrices && (($linesCfg['show_pu_pt_columns'] ?? true) !== false);
    $totalsCfg = is_array($layoutConfig['totals'] ?? null) ? $layoutConfig['totals'] : [];
    $showTotalHt = ($totalsCfg['show_total_ht'] ?? true) !== false;
    $showTotalTva = ($totalsCfg['show_total_tva'] ?? true) !== false;
    $showTotalTtc = ($totalsCfg['show_total_ttc'] ?? true) !== false;
    $showTvaCol = $showLinePrices && $showTotalTva && (($linesCfg['show_tva_column'] ?? true) !== false);
    $currencyLabel = $currencyLabel ?? 'DH';
@endphp
    <div class="header">
        @include('pdf.partials.branding-header', ['layoutConfig' => $layoutConfig ?? [], 'brandingLogoDataUri' => $brandingLogoDataUri ?? null])
        <h1>Facture n° {{ $invoice->number }}</h1>
        <p class="meta">Date facture : {{ $invoice->invoice_date->format('d/m/Y') }}</p>
        @if($invoice->order_date)
        <p class="meta">Date de commande : {{ $invoice->order_date->format('d/m/Y') }}</p>
        @endif
        @if($invoice->site_delivery_date)
        <p class="meta">Livraison chantier : {{ $invoice->site_delivery_date->format('d/m/Y') }}</p>
        @endif
        @if($invoice->due_date)
        <p class="meta">Échéance : {{ $invoice->due_date->format('d/m/Y') }}</p>
        @endif
        <p class="meta">Statut : {{ $invoice->status }}</p>
        <p class="meta"><strong>Client :</strong> {{ $invoice->client->name }}</p>
        @if($invoice->billingAddress)
        <p class="meta"><strong>Adresse facturation :</strong> {{ $invoice->billingAddress->labelFormatted() }}</p>
        @elseif($invoice->client->address)
        <p class="meta">{{ $invoice->client->address }}</p>
        @endif
        @if($invoice->deliveryAddress)
        <p class="meta"><strong>Adresse livraison :</strong> {{ $invoice->deliveryAddress->labelFormatted() }}</p>
        @endif
        @if($invoice->client->siret)
        <p class="meta">SIRET : {{ $invoice->client->siret }}</p>
        @endif
    </div>

    <table>
        <thead>
            <tr>
                <th>Désignation</th>
                <th class="text-right">Qté</th>
                @if($showPuPtCols)
                <th class="text-right">PU HT</th>
                <th class="text-right">Remise %</th>
                @endif
                @if($showTvaCol)
                <th class="text-right">TVA %</th>
                @endif
                @if($showPuPtCols)
                <th class="text-right">Total HT</th>
                @endif
            </tr>
        </thead>
        <tbody>
            @foreach($invoice->invoiceLines as $line)
            <tr>
                <td>{{ $line->description }}</td>
                <td class="text-right">{{ $line->quantity }}</td>
                @if($showPuPtCols)
                <td class="text-right">{{ number_format($line->unit_price, 2, ',', ' ') }} {{ $currencyLabel }}</td>
                <td class="text-right">{{ number_format($line->discount_percent, 2, ',', ' ') }}</td>
                @endif
                @if($showTvaCol)
                <td class="text-right">{{ number_format($line->tva_rate, 2, ',', ' ') }}</td>
                @endif
                @if($showPuPtCols)
                <td class="text-right">{{ number_format($line->total, 2, ',', ' ') }} {{ $currencyLabel }}</td>
                @endif
            </tr>
            @endforeach
        </tbody>
    </table>

    @if($showTotalHt || $showTotalTva || $showTotalTtc)
    <div class="totals">
        @if((float)$invoice->discount_percent > 0 || (float)$invoice->discount_amount > 0)
        <p>Remise document : {{ number_format($invoice->discount_percent, 2, ',', ' ') }} % @if((float)$invoice->discount_amount > 0) + {{ number_format($invoice->discount_amount, 2, ',', ' ') }} {{ $currencyLabel }} HT @endif</p>
        @endif
        @if((float)$invoice->shipping_amount_ht > 0)
        <p>Frais de port / livraison HT : {{ number_format($invoice->shipping_amount_ht, 2, ',', ' ') }} {{ $currencyLabel }} (TVA {{ number_format($invoice->shipping_tva_rate, 2, ',', ' ') }} %)</p>
        @endif
        @if($showTotalHt)
        <p><strong>Total HT :</strong> {{ number_format($invoice->amount_ht, 2, ',', ' ') }} {{ $currencyLabel }}</p>
        @endif
        @if($showTotalTva)
            @php
                $caRegime = (bool) ($invoice->client?->ca_annuel_tva_regime ?? false);
                $tvaEtat = max(0, (float) $invoice->amount_ttc - (float) $invoice->amount_ht);
                $tvaNominale = $caRegime ? round($tvaEtat / 0.75, 2) : $tvaEtat;
                $tvaRecuperable = $caRegime ? round($tvaNominale - $tvaEtat, 2) : 0;
            @endphp
            @if($caRegime)
                <p><strong>TVA nominale (20&nbsp;%) :</strong> {{ number_format($tvaNominale, 2, ',', ' ') }} {{ $currencyLabel }}</p>
                <p><strong>TVA récupérable (25&nbsp;%) :</strong> {{ number_format($tvaRecuperable, 2, ',', ' ') }} {{ $currencyLabel }}</p>
                <p><strong>TVA État (75&nbsp;%) :</strong> {{ number_format($tvaEtat, 2, ',', ' ') }} {{ $currencyLabel }}</p>
            @else
                <p><strong>Total TVA :</strong> {{ number_format($tvaEtat, 2, ',', ' ') }} {{ $currencyLabel }}</p>
            @endif
        @endif
        @if($showTotalTtc)
        <p><strong>Total TTC :</strong> {{ number_format($invoice->amount_ttc, 2, ',', ' ') }} {{ $currencyLabel }}</p>
        @endif
    </div>
    @endif

    @if(isset($template) && $template)
    <p class="muted" style="margin-top: 20px;">Modèle PDF : {{ $template->name }}</p>
    @endif
    <p class="muted" style="margin-top: 12px;">Document généré par la plateforme Lab BTP.</p>
</body>
</html>
