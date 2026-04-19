<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Devis {{ $quote->number }}</title>
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
    <div class="header">
        @include('pdf.partials.branding-header', ['layoutConfig' => $layoutConfig ?? [], 'brandingLogoDataUri' => $brandingLogoDataUri ?? null])
        <h1>Devis n° {{ $quote->number }}</h1>
        <p class="meta">Date devis : {{ $quote->quote_date->format('d/m/Y') }}</p>
        @if($quote->order_date)
        <p class="meta">Date de commande : {{ $quote->order_date->format('d/m/Y') }}</p>
        @endif
        @if($quote->site_delivery_date)
        <p class="meta">Livraison chantier prévue : {{ $quote->site_delivery_date->format('d/m/Y') }}</p>
        @endif
        @if($quote->valid_until)
        <p class="meta">Valide jusqu'au : {{ $quote->valid_until->format('d/m/Y') }}</p>
        @endif
        <p class="meta">Statut : {{ $quote->status }}</p>
        <p class="meta"><strong>Client :</strong> {{ $quote->client->name }}</p>
        @if($quote->billingAddress)
        <p class="meta"><strong>Adresse facturation :</strong> {{ $quote->billingAddress->labelFormatted() }}</p>
        @elseif($quote->client->address)
        <p class="meta">{{ $quote->client->address }}</p>
        @endif
        @if($quote->deliveryAddress)
        <p class="meta"><strong>Adresse livraison :</strong> {{ $quote->deliveryAddress->labelFormatted() }}</p>
        @endif
        @if($quote->site)
        <p class="meta"><strong>Chantier :</strong> {{ $quote->site->name }}</p>
        @endif
    </div>

    <table>
        <thead>
            <tr>
                <th>Désignation</th>
                <th class="text-right">Qté</th>
                <th class="text-right">PU HT</th>
                <th class="text-right">Remise %</th>
                <th class="text-right">TVA %</th>
                <th class="text-right">Total HT</th>
            </tr>
        </thead>
        <tbody>
            @foreach($quote->quoteLines as $line)
            <tr>
                <td>{{ $line->description }}</td>
                <td class="text-right">{{ $line->quantity }}</td>
                <td class="text-right">{{ number_format($line->unit_price, 2, ',', ' ') }} {{ $currencyLabel }}</td>
                <td class="text-right">{{ number_format($line->discount_percent, 2, ',', ' ') }}</td>
                <td class="text-right">{{ number_format($line->tva_rate, 2, ',', ' ') }}</td>
                <td class="text-right">{{ number_format($line->total, 2, ',', ' ') }} {{ $currencyLabel }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        @if((float)$quote->discount_percent > 0 || (float)$quote->discount_amount > 0)
        <p>Remise document : {{ number_format($quote->discount_percent, 2, ',', ' ') }} % @if((float)$quote->discount_amount > 0) + {{ number_format($quote->discount_amount, 2, ',', ' ') }} {{ $currencyLabel }} HT @endif</p>
        @endif
        @if((float)$quote->shipping_amount_ht > 0)
        <p>Frais de port / livraison HT : {{ number_format($quote->shipping_amount_ht, 2, ',', ' ') }} {{ $currencyLabel }} (TVA {{ number_format($quote->shipping_tva_rate, 2, ',', ' ') }} %)</p>
        @endif
        <p><strong>Total HT :</strong> {{ number_format($quote->amount_ht, 2, ',', ' ') }} {{ $currencyLabel }}</p>
        <p><strong>Total TTC :</strong> {{ number_format($quote->amount_ttc, 2, ',', ' ') }} {{ $currencyLabel }}</p>
    </div>

    @if($quote->notes)
    <p style="margin-top: 16px; font-size: 9px;">{{ $quote->notes }}</p>
    @endif

    @if(isset($template) && $template)
    <p class="muted" style="margin-top: 20px;">Modèle PDF : {{ $template->name }}</p>
    @endif
    <p class="muted" style="margin-top: 12px;">Document généré par la plateforme Lab BTP.</p>
</body>
</html>
