<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Note de frais {{ $report->unique_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #111; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        .meta { margin: 3px 0; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #eee; font-size: 9px; }
        .text-right { text-align: right; }
        .totals { margin-top: 14px; width: 45%; margin-left: auto; }
        .totals td { border: none; padding: 4px 6px; }
        .totals .label { text-align: right; color: #555; }
        .totals .value { text-align: right; font-weight: bold; }
        .totals .primary .value { font-size: 13px; color: #1d4ed8; }
        .badge-ok { color: #065f46; font-weight: bold; }
        .badge-no { color: #991b1b; }
        .notes { margin-top: 12px; padding: 8px; background: #f8fafc; border: 1px solid #cbd5e1; }
    </style>
</head>
<body>
@php extract(\App\Support\AppBranding::commercialLayoutViewVars($layoutConfig ?? [])); @endphp
@php
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ');
    $total = (float) ($report->total ?? $report->lines->sum('amount'));
    $advance = (float) ($report->advance_amount ?? 0);
    $net = max(0, $total - $advance);
    $om = $report->ordreMission;
    $statut = $statutLabels[$report->statut] ?? $report->statut;
@endphp
@include('pdf.partials.branding-header', ['layoutConfig' => $layoutConfig ?? [], 'brandingLogoDataUri' => $brandingLogoDataUri ?? null])

<h1>Note de frais {{ $report->unique_number }}</h1>
<p class="meta"><strong>Statut :</strong> {{ $statut }}</p>
<p class="meta"><strong>Créée le :</strong> {{ $report->created_at?->format('d/m/Y') ?? '—' }}</p>
@if($om)
<p class="meta">
    <strong>OM :</strong> {{ $om->unique_number ?? $om->numero }}
    @if($om->dossier) · <strong>Dossier :</strong> {{ $om->dossier->reference ?? $om->dossier->titre }} @endif
    @if($om->client) · <strong>Client :</strong> {{ $om->client->name }} @endif
    @if($om->site) · <strong>Chantier :</strong> {{ $om->site->name }} @endif
</p>
@endif

<table>
    <thead>
        <tr>
            <th style="width: 24px;">✓</th>
            <th>Date</th>
            <th>Catégorie</th>
            <th>Personnel</th>
            <th>Paiement</th>
            <th>Description</th>
            <th class="text-right">Montant TTC</th>
        </tr>
    </thead>
    <tbody>
        @forelse($report->lines as $line)
        @php
            $pay = $line->payment_method ? ($paymentLabels[$line->payment_method] ?? $line->payment_method) : '—';
            $desc = trim((string) ($line->description ?? ''));
            if ($line->distance_km !== null) {
                $trajet = trim(implode(' → ', array_filter([$line->lieu_depart, $line->lieu_arrivee])));
                $km = $trajet !== '' ? "{$trajet} · {$line->distance_km} km" : "{$line->distance_km} km (A/R)";
                $desc = $desc !== '' ? "{$desc} · {$km}" : $km;
            }
        @endphp
        <tr>
            <td class="{{ $line->is_validated ? 'badge-ok' : 'badge-no' }}">{{ $line->is_validated ? '✓' : '○' }}</td>
            <td>{{ $line->date?->format('d/m/Y') ?? '—' }}</td>
            <td>{{ $line->category }}</td>
            <td>{{ $line->user?->name ?? '—' }}</td>
            <td>{{ $pay }}</td>
            <td>{{ $desc !== '' ? $desc : '—' }}</td>
            <td class="text-right">{{ $fmt($line->amount) }} {{ $currencyLabel }}</td>
        </tr>
        @empty
        <tr><td colspan="7">Aucune ligne de frais</td></tr>
        @endforelse
    </tbody>
</table>

<table class="totals">
    <tr>
        <td class="label">Total TTC</td>
        <td class="value">{{ $fmt($total) }} {{ $currencyLabel }}</td>
    </tr>
    @if($advance > 0)
    <tr>
        <td class="label">Acompte versé</td>
        <td class="value">{{ $fmt($advance) }} {{ $currencyLabel }}</td>
    </tr>
    <tr class="primary">
        <td class="label">Net à rembourser</td>
        <td class="value">{{ $fmt($net) }} {{ $currencyLabel }}</td>
    </tr>
    @endif
</table>

@if($report->notes)
<div class="notes">
    <strong>Notes :</strong><br>{!! nl2br(e($report->notes)) !!}
</div>
@endif
</body>
</html>
