<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>{{ $title }}</title>
    <style>
        @page { margin: 24px 26px 28px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #172033; }
        h1 { margin: 0 0 3px; font-size: 18px; text-transform: uppercase; color: #173f70; }
        .period { margin: 0 0 14px; color: #526277; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th { padding: 7px 5px; color: #fff; background: #173f70; border: 1px solid #173f70; text-align: left; }
        td { padding: 6px 5px; border: 1px solid #aeb8c5; vertical-align: top; overflow-wrap: anywhere; }
        tbody tr:nth-child(even) td { background: #f4f7fa; }
        .empty { padding: 24px; text-align: center; color: #68768a; }
        .qty { text-align: right; white-space: nowrap; }
        .date { white-space: nowrap; }
        .notes { white-space: pre-wrap; }
        .footer { margin-top: 10px; text-align: right; color: #68768a; font-size: 8px; }
        .page-break { page-break-before: always; }
        .continuation { margin: 0 0 8px; color: #526277; font-size: 9px; font-weight: bold; }
    </style>
</head>
<body>
@php
    $planningConfig = is_array($layoutConfig['planning'] ?? null) ? $layoutConfig['planning'] : [];
    $show = fn (string $key) => ($planningConfig[$key] ?? true) !== false;
    $formatQty = function ($value) {
        $number = (float) $value;
        return abs($number - round($number)) < 0.0001
            ? number_format($number, 0, ',', ' ')
            : rtrim(rtrim(number_format($number, 3, ',', ' '), '0'), ',');
    };
    // Pagination explicite : DomPDF peut perdre les dernières lignes d'une longue table.
    $pageChunks = $affectations->isEmpty() ? collect([collect()]) : $affectations->chunk(9)->values();
@endphp
    @include('pdf.partials.branding-header', ['layoutConfig' => $layoutConfig ?? [], 'brandingLogoDataUri' => $brandingLogoDataUri ?? null])
    <h1>{{ $title }}</h1>
    <p class="period">{{ $periodLabel }}</p>

    @foreach($pageChunks as $pageIndex => $pageRows)
    @if($pageIndex > 0)
        <div class="page-break"></div>
        <p class="continuation">{{ $title }} — {{ $periodLabel }} — suite</p>
    @endif
    <table>
        <thead>
            <tr>
                @if($show('show_start_date'))<th style="width:8%">Démarrage</th>@endif
                @if($show('show_end_date'))<th style="width:8%">Fin</th>@endif
                @if($show('show_technician'))<th style="width:13%">Technicien</th>@endif
                @if($show('show_client'))<th style="width:14%">Client</th>@endif
                @if($show('show_order'))<th style="width:12%">Bon de commande</th>@endif
                @if($show('show_task'))<th>Tâche</th>@endif
                @if($show('show_quantity'))<th style="width:6%">Quantité</th>@endif
                @if($show('show_notes'))<th style="width:18%">Commentaires / notes</th>@endif
            </tr>
        </thead>
        <tbody>
            @forelse($pageRows as $affectation)
                @php
                    $line = $affectation->bonCommandeLigne;
                    $order = $line?->bonCommande;
                    $notes = array_values(array_unique(array_filter([
                        trim((string) $affectation->notes),
                        trim((string) $line?->notes_ligne),
                    ])));
                @endphp
                <tr>
                    @if($show('show_start_date'))<td class="date">{{ $affectation->date_debut?->format('d/m/Y') ?? '—' }}</td>@endif
                    @if($show('show_end_date'))<td class="date">{{ $affectation->date_fin?->format('d/m/Y') ?? '—' }}</td>@endif
                    @if($show('show_technician'))<td><strong>{{ $affectation->user?->name ?? '—' }}</strong></td>@endif
                    @if($show('show_client'))<td>{{ $order?->client?->name ?? '—' }}</td>@endif
                    @if($show('show_order'))<td>{{ $order?->numero ?? '—' }}</td>@endif
                    @if($show('show_task'))<td>{{ $line?->libelle ?? '—' }}</td>@endif
                    @if($show('show_quantity'))<td class="qty">{{ $line ? $formatQty($line->quantite) : '—' }}</td>@endif
                    @if($show('show_notes'))<td class="notes">{{ $notes !== [] ? implode("\n", $notes) : '—' }}</td>@endif
                </tr>
            @empty
                <tr><td class="empty" colspan="8">Aucune tâche planifiée sur cette période.</td></tr>
            @endforelse
        </tbody>
    </table>
    @endforeach
    <div class="footer">Généré le {{ $generatedAt }}</div>
</body>
</html>
