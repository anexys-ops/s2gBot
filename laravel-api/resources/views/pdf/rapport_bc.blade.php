<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Rapport {{ $rapport->numero }}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10.5px; color: #111; line-height: 1.4; }
        h1  { font-size: 15px; margin-bottom: 4px; }
        h2  { font-size: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin: 18px 0 8px; color: #1a3a5c; }
        .meta { color: #555; margin: 3px 0; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: bold; }
        .badge-brouillon    { background: #f3f4f6; color: #6b7280; }
        .badge-preliminaire { background: #fef3c7; color: #b45309; }
        .badge-valide       { background: #d1fae5; color: #065f46; }
        .badge-archive      { background: #ede9fe; color: #7c3aed; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #ddd; padding: 5px 7px; text-align: left; vertical-align: top; }
        th { background: #f0f4f8; font-size: 9.5px; text-transform: uppercase; color: #374151; }
        tr:nth-child(even) { background: #fafafa; }
        .section { margin-bottom: 18px; }
        .info-grid { display: table; width: 100%; margin-top: 6px; }
        .info-col  { display: table-cell; width: 50%; vertical-align: top; padding-right: 16px; }
        .info-row  { margin-bottom: 4px; }
        .info-label { font-weight: bold; font-size: 9px; text-transform: uppercase; color: #6b7280; }
        .info-val   { font-size: 10.5px; }
        .footer { margin-top: 28px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px; }
        .statut-label { font-size: 9px; text-transform: uppercase; color: #6b7280; }
    </style>
</head>
<body>
@php
    $lc = $layoutConfig ?? [];
    $statut_labels = [
        'brouillon'    => 'Brouillon',
        'preliminaire' => 'Préliminaire',
        'valide'       => 'Validé',
        'archive'      => 'Archivé',
    ];
    $bc = $rapport->bonCommande;
    $client = $bc?->client;
    $dossier = $bc?->dossier;
    $site = $dossier?->site;
    $createdBy = $rapport->createdBy;
@endphp

@include('pdf.partials.branding-header', [
    'layoutConfig'        => $lc,
    'brandingLogoDataUri' => $brandingLogoDataUri ?? null,
])

{{-- Titre --}}
<h1>Rapport de mission — {{ $rapport->numero }}</h1>
@if($rapport->titre)
<p style="font-size:12px;color:#374151;margin:3px 0 8px;">{{ $rapport->titre }}</p>
@endif
<span class="badge badge-{{ $rapport->statut }}">{{ $statut_labels[$rapport->statut] ?? $rapport->statut }}</span>

{{-- Informations générales --}}
<h2>Informations générales</h2>
<div class="info-grid">
    <div class="info-col">
        <div class="info-row">
            <div class="info-label">Numéro de rapport</div>
            <div class="info-val">{{ $rapport->numero }}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Date de création</div>
            <div class="info-val">{{ $rapport->created_at->format('d/m/Y') }}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Créé par</div>
            <div class="info-val">{{ $createdBy?->name ?? '—' }}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Statut</div>
            <div class="info-val">{{ $statut_labels[$rapport->statut] ?? $rapport->statut }}</div>
        </div>
    </div>
    <div class="info-col">
        <div class="info-row">
            <div class="info-label">Bon de commande</div>
            <div class="info-val">{{ $bc?->numero ?? '—' }}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Client</div>
            <div class="info-val">{{ $client?->name ?? '—' }}</div>
        </div>
        @if($dossier)
        <div class="info-row">
            <div class="info-label">Dossier</div>
            <div class="info-val">{{ $dossier->reference ?? '' }}{{ $dossier->reference && $dossier->titre ? ' — ' : '' }}{{ $dossier->titre ?? '' }}</div>
        </div>
        @endif
        @if($site)
        <div class="info-row">
            <div class="info-label">Site / Chantier</div>
            <div class="info-val">{{ $site->name ?? '—' }}</div>
        </div>
        @endif
    </div>
</div>

@if($rapport->notes)
<div style="margin-top:10px;background:#f9fafb;border-left:3px solid #cbd5e1;padding:7px 10px;border-radius:3px;">
    <div class="info-label">Notes</div>
    <div style="margin-top:3px;">{{ $rapport->notes }}</div>
</div>
@endif

{{-- Tâches associées --}}
@if($rapport->taches->isNotEmpty())
<h2>Tâches associées ({{ $rapport->taches->count() }})</h2>
<table>
    <thead>
        <tr>
            <th>Libellé</th>
            <th>Responsable</th>
            <th>Statut</th>
            <th>Date planifiée</th>
            <th>Date réalisation</th>
        </tr>
    </thead>
    <tbody>
        @foreach($rapport->taches as $tache)
        <tr>
            <td>{{ $tache->libelle ?? 'Tâche #'.$tache->id }}</td>
            <td>{{ $tache->assignedUser?->name ?? '—' }}</td>
            <td>{{ $tache->statut }}</td>
            <td>{{ $tache->planned_date ? \Carbon\Carbon::parse($tache->planned_date)->format('d/m/Y') : '—' }}</td>
            <td>{{ $tache->completed_at ? \Carbon\Carbon::parse($tache->completed_at)->format('d/m/Y') : '—' }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

{{-- Versions / pièces jointes --}}
@if($rapport->versions->isNotEmpty())
<h2>Pièces jointes — Versions ({{ $rapport->versions->count() }})</h2>
<table>
    <thead>
        <tr>
            <th>Version</th>
            <th>Nom du fichier</th>
            <th>Déposé le</th>
            <th>Déposé par</th>
            <th>Taille</th>
            <th>Note</th>
        </tr>
    </thead>
    <tbody>
        @foreach($rapport->versions->sortByDesc('version_number') as $version)
        <tr>
            <td style="font-weight:bold;">v{{ $version->version_number }}</td>
            <td>{{ $version->original_filename ?? '—' }}</td>
            <td>{{ $version->created_at->format('d/m/Y') }}</td>
            <td>{{ $version->uploadedByUser?->name ?? '—' }}</td>
            <td>{{ $version->file_size ? number_format($version->file_size / 1024, 0, ',', ' ').' Ko' : '—' }}</td>
            <td style="color:#6b7280;font-style:italic;">{{ $version->upload_notes ?? '' }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

{{-- Activité / Suivis --}}
@if($rapport->suivis->isNotEmpty())
<h2>Activité</h2>
<table>
    <thead>
        <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Par</th>
            <th>Message</th>
        </tr>
    </thead>
    <tbody>
        @foreach($rapport->suivis->sortBy('created_at') as $suivi)
        @php
            $type_labels = ['note' => 'Note', 'statut_change' => 'Changement statut', 'upload' => 'Dépôt fichier', 'validation' => 'Validation'];
        @endphp
        <tr>
            <td style="white-space:nowrap;">{{ $suivi->created_at->format('d/m/Y H:i') }}</td>
            <td>{{ $type_labels[$suivi->type] ?? $suivi->type }}</td>
            <td>{{ $suivi->user?->name ?? 'Système' }}</td>
            <td>{{ $suivi->message }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

<div class="footer">
    Généré le {{ now()->format('d/m/Y à H:i') }}
    @if($template)
     — Modèle : {{ $template->name }}
    @endif
</div>
</body>
</html>
