<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Devis {{ $quote->number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; }
        h1 { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
        th { background: #eee; }
        .header { margin-bottom: 20px; }
        .meta { margin: 5px 0; color: #555; }
        .totals { margin-top: 20px; text-align: right; }
        .text-right { text-align: right; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Devis n° {{ $quote->number }}</h1>
        <p class="meta">Date devis : {{ $quote->quote_date->format('d/m/Y') }}</p>
        @if($quote->order_date ?? null)
        <p class="meta">Date de commande : {{ $quote->order_date->format('d/m/Y') }}</p>
        @endif
        @if($quote->site_delivery_date ?? null)
        <p class="meta">Livraison chantier : {{ $quote->site_delivery_date->format('d/m/Y') }}</p>
        @endif
        @if($quote->valid_until)
        <p class="meta">Valide jusqu'au : {{ $quote->valid_until->format('d/m/Y') }}</p>
        @endif
        <p class="meta">Statut : {{ $quote->status }}</p>
        <p class="meta">Client : {{ $quote->client->name }}</p>
        @if($quote->billingAddress ?? null)
        <p class="meta">Facturation : {{ $quote->billingAddress->labelFormatted() }}</p>
        @elseif($quote->client->address)<p class="meta">{{ $quote->client->address }}</p>@endif
        @if($quote->deliveryAddress ?? null)
        <p class="meta">Livraison : {{ $quote->deliveryAddress->labelFormatted() }}</p>
        @endif
        @if($quote->site)
        <p class="meta">Chantier : {{ $quote->site->name }}</p>
        @endif
    </div>

    <table>
        <thead>
            <tr>
                <th>Désignation</th>
                <th>Qté</th>
                <th>Prix unitaire HT</th>
                <th class="text-right">Total HT</th>
            </tr>
        </thead>
        <tbody>
            @foreach($quote->quoteLines as $line)
            <tr>
                <td>{{ $line->description }}</td>
                <td>{{ $line->quantity }}</td>
                <td>{{ number_format($line->unit_price, 2, ',', ' ') }} €</td>
                <td class="text-right">{{ number_format($line->total, 2, ',', ' ') }} €</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        @if((float)($quote->discount_percent ?? 0) > 0 || (float)($quote->discount_amount ?? 0) > 0)
        <p>Remise : {{ number_format((float)($quote->discount_percent ?? 0), 2, ',', ' ') }} % @if((float)($quote->discount_amount ?? 0) > 0) — {{ number_format($quote->discount_amount, 2, ',', ' ') }} € HT @endif</p>
        @endif
        @if((float)($quote->shipping_amount_ht ?? 0) > 0)
        <p>Port / livraison HT : {{ number_format($quote->shipping_amount_ht, 2, ',', ' ') }} €</p>
        @endif
        <p>Total HT : {{ number_format($quote->amount_ht, 2, ',', ' ') }} €</p>
        <p>TVA (global {{ $quote->tva_rate }} %) : {{ number_format($quote->amount_ttc - $quote->amount_ht, 2, ',', ' ') }} €</p>
        <p><strong>Total TTC : {{ number_format($quote->amount_ttc, 2, ',', ' ') }} €</strong></p>
    </div>

    @if($quote->notes)
    <p style="margin-top: 20px; font-size: 10px;">{{ $quote->notes }}</p>
    @endif

    <p style="margin-top: 30px; font-size: 10px; color: #666;">Document généré par la plateforme Lab BTP.</p>
</body>
</html>
