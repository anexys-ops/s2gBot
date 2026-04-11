<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Rapport d'essais - {{ $order->reference }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; }
        h1 { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
        th { background: #eee; }
        .header { margin-bottom: 20px; }
        .meta { margin: 10px 0; color: #555; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Rapport d'essais - {{ $order->reference }}</h1>
        <p class="meta">Client : {{ $order->client->name }}</p>
        @if($order->site)
        <p class="meta">Chantier : {{ $order->site->name }} ({{ $order->site->reference }})</p>
        @endif
        <p class="meta">Date commande : {{ $order->order_date->format('d/m/Y') }}</p>
        <p class="meta">Date du rapport : {{ now()->format('d/m/Y H:i') }}</p>
    </div>

    @foreach($order->orderItems as $item)
    <h2>{{ $item->testType->name }} @if($item->testType->norm)({{ $item->testType->norm }})@endif</h2>
    @foreach($item->samples as $sample)
    <p><strong>Échantillon :</strong> {{ $sample->reference }} — Statut : {{ $sample->status }}</p>
    <table>
        <thead>
            <tr>
                <th>Paramètre</th>
                <th>Valeur</th>
                <th>Unité</th>
            </tr>
        </thead>
        <tbody>
            @foreach($sample->testResults as $res)
            <tr>
                <td>{{ $res->testTypeParam->name }}</td>
                <td>{{ $res->value }}</td>
                <td>{{ $res->testTypeParam->unit ?? '-' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endforeach
    @endforeach

    @php $fd = $formData ?? []; @endphp
    @if(!empty($fd))
    <h2 style="margin-top: 20px;">Formulaire terrain / service</h2>
    <table>
        <thead><tr><th>Champ</th><th>Valeur</th></tr></thead>
        <tbody>
        @foreach($fd as $k => $v)
            <tr><td>{{ is_string($k) ? $k : '—' }}</td><td>{{ is_scalar($v) ? $v : json_encode($v) }}</td></tr>
        @endforeach
        </tbody>
    </table>
    @endif

    @if(isset($report) && $report->signed_at)
    <div style="margin-top: 40px; border-top: 1px solid #333; padding-top: 16px;">
        <p><strong>Signé électroniquement</strong> le {{ $report->signed_at->format('d/m/Y H:i') }}</p>
        @if($report->signer_name)<p>Signataire : {{ $report->signer_name }}</p>@endif
        @if($report->signature_image_data)
        <p><img src="{{ $report->signature_image_data }}" alt="Signature" style="max-height: 80px; max-width: 280px;" /></p>
        @endif
    </div>
    @endif

    <p style="margin-top: 30px; font-size: 10px; color: #666;">Document généré automatiquement par la plateforme Lab BTP.</p>
</body>
</html>
