<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Facture {{ $invoice->number }}</title>
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
        <h1>Facture n° {{ $invoice->number }}</h1>
        <p class="meta">Date facture : {{ $invoice->invoice_date->format('d/m/Y') }}</p>
        @if($invoice->order_date ?? null)
        <p class="meta">Date de commande : {{ $invoice->order_date->format('d/m/Y') }}</p>
        @endif
        @if($invoice->site_delivery_date ?? null)
        <p class="meta">Livraison chantier : {{ $invoice->site_delivery_date->format('d/m/Y') }}</p>
        @endif
        @if($invoice->due_date)
        <p class="meta">Échéance : {{ $invoice->due_date->format('d/m/Y') }}</p>
        @endif
        <p class="meta">Statut : {{ $invoice->status }}</p>
        <p class="meta">Client : {{ $invoice->client->name }}</p>
        @if($invoice->billingAddress ?? null)
        <p class="meta">Facturation : {{ $invoice->billingAddress->labelFormatted() }}</p>
        @elseif($invoice->client->address)<p class="meta">{{ $invoice->client->address }}</p>@endif
        @if($invoice->deliveryAddress ?? null)
        <p class="meta">Livraison : {{ $invoice->deliveryAddress->labelFormatted() }}</p>
        @endif
        @if($invoice->client->siret)<p class="meta">SIRET : {{ $invoice->client->siret }}</p>@endif
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
            @foreach($invoice->invoiceLines as $line)
            <tr>
                <td>{{ $line->description }}</td>
                <td>{{ $line->quantity }}</td>
                <td>{{ number_format($line->unit_price, 2, ',', ' ') }} {{ $currencyLabel }}</td>
                <td class="text-right">{{ number_format($line->total, 2, ',', ' ') }} {{ $currencyLabel }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        @if((float)($invoice->discount_percent ?? 0) > 0 || (float)($invoice->discount_amount ?? 0) > 0)
        <p>Remise : {{ number_format((float)($invoice->discount_percent ?? 0), 2, ',', ' ') }} % @if((float)($invoice->discount_amount ?? 0) > 0) — {{ number_format($invoice->discount_amount, 2, ',', ' ') }} {{ $currencyLabel }} HT @endif</p>
        @endif
        @if((float)($invoice->shipping_amount_ht ?? 0) > 0)
        <p>Port / livraison HT : {{ number_format($invoice->shipping_amount_ht, 2, ',', ' ') }} {{ $currencyLabel }}</p>
        @endif
        <p>Total HT : {{ number_format($invoice->amount_ht, 2, ',', ' ') }} {{ $currencyLabel }}</p>
        <p>TVA (global {{ $invoice->tva_rate }} %) : {{ number_format($invoice->amount_ttc - $invoice->amount_ht, 2, ',', ' ') }} {{ $currencyLabel }}</p>
        <p><strong>Total TTC : {{ number_format($invoice->amount_ttc, 2, ',', ' ') }} {{ $currencyLabel }}</strong></p>
    </div>

    <p style="margin-top: 30px; font-size: 10px; color: #666;">Document généré par la plateforme Lab BTP.</p>
</body>
</html>
