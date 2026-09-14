<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Dossier {{ $dossier->reference }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 20px; }
        h1 { font-size: 17px; margin: 0 0 4px; }
        h2 { font-size: 13px; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; color: #333; }
        .meta { margin: 3px 0; color: #444; }
        .badge { display: inline-block; background: #e8f0fe; color: #1a56db; padding: 1px 7px; border-radius: 99px; font-size: 10px; font-weight: bold; }
        .badge-statut { background: #fef3c7; color: #92400e; }
        .grid2 { display: table; width: 100%; margin-top: 8px; }
        .grid2-col { display: table-cell; width: 50%; vertical-align: top; padding-right: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
        th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; font-weight: bold; }
        .text-muted { color: #666; }
        .section { margin-top: 16px; }
        .label { font-weight: 600; min-width: 130px; display: inline-block; }
        dl { margin: 0; }
        dt { float: left; clear: left; min-width: 140px; font-weight: 600; color: #374151; margin-bottom: 4px; }
        dd { margin-left: 150px; margin-bottom: 4px; }
        .notes-box { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; background: #f9fafb; margin-top: 6px; white-space: pre-wrap; }
        .footer { position: fixed; bottom: 15px; left: 20px; right: 20px; font-size: 9px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 4px; display: flex; justify-content: space-between; }
    </style>
</head>
<body>
@php
    $statuts = [
        'brouillon' => 'Brouillon',
        'en_cours' => 'En cours',
        'cloture' => 'Clôturé',
        'archive' => 'Archivé',
    ];
    $statutLabel = $statuts[$dossier->statut] ?? $dossier->statut;
@endphp

@include('pdf.partials.branding-header', ['layoutConfig' => [], 'brandingLogoDataUri' => $brandingLogoDataUri ?? null])

<h1>Fiche dossier — {{ $dossier->reference }}</h1>
<p style="margin:2px 0 10px; font-size:13px; color:#374151;">{{ $dossier->titre }}</p>

<span class="badge badge-statut">{{ $statutLabel }}</span>
@if($dossier->centreGroup)
<span class="badge" style="margin-left:6px;">{{ $dossier->centreGroup->name }}</span>
@endif

<div class="section">
    <h2>Informations générales</h2>
    <dl>
        <dt>Client</dt>
        <dd>{{ $dossier->client?->name ?? '—' }}</dd>
        <dt>Chantier</dt>
        <dd>{{ $dossier->site?->name ?? '—' }}</dd>
        @if($dossier->mission)
        <dt>Mission</dt>
        <dd>{{ $dossier->mission->reference }}{{ $dossier->mission->title ? ' — '.$dossier->mission->title : '' }}</dd>
        @endif
        <dt>Date début</dt>
        <dd>{{ $dossier->date_debut?->format('d/m/Y') ?? '—' }}</dd>
        @if($dossier->date_fin_prevue)
        <dt>Date fin prévue</dt>
        <dd>{{ $dossier->date_fin_prevue->format('d/m/Y') }}</dd>
        @endif
        @if($dossier->maitre_ouvrage)
        <dt>Maître d'ouvrage</dt>
        <dd>{{ $dossier->maitre_ouvrage }}</dd>
        @endif
        @if($dossier->entreprise_chantier)
        <dt>Entreprise chantier</dt>
        <dd>{{ $dossier->entreprise_chantier }}</dd>
        @endif
        <dt>Créé par</dt>
        <dd>{{ $dossier->createur?->name ?? '—' }}</dd>
        <dt>Créé le</dt>
        <dd>{{ $dossier->created_at?->format('d/m/Y') ?? '—' }}</dd>
    </dl>
</div>

@if($dossier->contacts && $dossier->contacts->count() > 0)
<div class="section">
    <h2>Contacts</h2>
    <table>
        <thead>
            <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Email</th>
                <th>Téléphone</th>
            </tr>
        </thead>
        <tbody>
            @foreach($dossier->contacts as $contact)
            <tr>
                <td>{{ $contact->prenom ? $contact->prenom.' ' : '' }}{{ $contact->nom }}</td>
                <td>{{ $contact->role ?? '—' }}</td>
                <td>{{ $contact->email ?? '—' }}</td>
                <td>{{ $contact->telephone ?? '—' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endif

@if($dossier->quotes && $dossier->quotes->count() > 0)
<div class="section">
    <h2>Devis ({{ $dossier->quotes->count() }})</h2>
    <table>
        <thead>
            <tr><th>N°</th><th>Date</th><th>Statut</th><th>Total HT</th></tr>
        </thead>
        <tbody>
            @foreach($dossier->quotes as $q)
            <tr>
                <td>{{ $q->number }}</td>
                <td>{{ $q->quote_date ? \Carbon\Carbon::parse($q->quote_date)->format('d/m/Y') : '—' }}</td>
                <td>{{ $q->status }}</td>
                <td class="text-right">{{ number_format((float)($q->total_ht ?? 0), 2, ',', ' ') }} DH</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endif

@if($dossier->notes)
<div class="section">
    <h2>Notes</h2>
    <div class="notes-box">{{ $dossier->notes }}</div>
</div>
@endif

<div class="footer">
    <span>{{ $dossier->reference }} — {{ $dossier->titre }}</span>
    <span>Imprimé le {{ now()->format('d/m/Y à H:i') }}</span>
</div>
</body>
</html>
