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
    <div class="header">
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
                <th class="text-right">PU HT</th>
                <th class="text-right">Remise %</th>
                <th class="text-right">TVA %</th>
                <th class="text-right">Total HT</th>
            </tr>
        </thead>
        <tbody>
            @foreach($invoice->invoiceLines as $line)
            <tr>
                <td>{{ $line->description }}</td>
                <td class="text-right">{{ $line->quantity }}</td>
                <td class="text-right">{{ number_format($line->unit_price, 2, ',', ' ') }} €</td>
                <td class="text-right">{{ number_format($line->discount_percent, 2, ',', ' ') }}</td>
                <td class="text-right">{{ number_format($line->tva_rate, 2, ',', ' ') }}</td>
                <td class="text-right">{{ number_format($line->total, 2, ',', ' ') }} €</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        @if((float)$invoice->discount_percent > 0 || (float)$invoice->discount_amount > 0)
        <p>Remise document : {{ number_format($invoice->discount_percent, 2, ',', ' ') }} % @if((float)$invoice->discount_amount > 0) + {{ number_format($invoice->discount_amount, 2, ',', ' ') }} € HT @endif</p>
        @endif
        @if((float)$invoice->shipping_amount_ht > 0)
        <p>Frais de port / livraison HT : {{ number_format($invoice->shipping_amount_ht, 2, ',', ' ') }} € (TVA {{ number_format($invoice->shipping_tva_rate, 2, ',', ' ') }} %)</p>
        @endif
        <p><strong>Total HT :</strong> {{ number_format($invoice->amount_ht, 2, ',', ' ') }} €</p>
        <p><strong>Total TTC :</strong> {{ number_format($invoice->amount_ttc, 2, ',', ' ') }} €</p>
    </div>

    @if(isset($template) && $template)
    <p class="muted" style="margin-top: 20px;">Modèle PDF : {{ $template->name }}</p>
    @endif
    <p class="muted" style="margin-top: 12px;">Document généré par la plateforme Lab BTP.</p>
</body>
</html>
