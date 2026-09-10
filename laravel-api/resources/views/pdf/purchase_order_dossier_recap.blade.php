<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Récap dossier — BC {{ $bonCommande->numero }}</title>
    <style>
        @page { size: A4 portrait; margin: 12mm 14mm 14mm; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 9.5pt;
            color: #111;
            margin: 0;
            padding: 0;
        }
        h1 { font-size: 14pt; margin: 0 0 4px; color: #1c3a6e; }
        h2 {
            font-size: 10pt;
            margin: 0 0 8px;
            color: #1c3a6e;
            border-bottom: 1px solid #c0c0c0;
            padding-bottom: 4px;
        }
        .meta { margin: 3px 0; color: #444; }
        .section {
            margin-bottom: 14px;
            padding: 10px 12px;
            border: 1px solid #d8d8d8;
            background: #fafafa;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #eee; font-size: 9pt; }
        .info-grid { width: 100%; border-collapse: collapse; }
        .info-grid td {
            border: none;
            padding: 2px 0;
            vertical-align: top;
        }
        .info-grid td:first-child {
            font-weight: bold;
            white-space: nowrap;
            width: 1%;
            padding-right: 10px;
            color: #333;
        }
        .text-right { text-align: right; }
        .subtitle { font-size: 10pt; color: #555; margin-bottom: 12px; }
    </style>
</head>
<body>
@php
    extract(\App\Support\AppBranding::commercialLayoutViewVars($layoutConfig ?? []));
    $ctx = $pdfContext ?? [];
    $client = is_array($ctx['client'] ?? null) ? $ctx['client'] : [];
    $dossier = is_array($ctx['dossier'] ?? null) ? $ctx['dossier'] : [];
    $site = is_array($ctx['site'] ?? null) ? $ctx['site'] : [];
    $dossierContacts = is_array($ctx['dossier_contacts'] ?? null) ? $ctx['dossier_contacts'] : [];
    $currencyLabel = $currencyLabel ?? 'DH';
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ');
@endphp

@include('pdf.partials.branding-header', ['layoutConfig' => $layoutConfig ?? [], 'brandingLogoDataUri' => $brandingLogoDataUri ?? null])

<h1>Récapitulatif dossier</h1>
<p class="subtitle">
    Bon de commande n° <strong>{{ $bonCommande->numero }}</strong>
    @if(!empty($ctx['bc_statut_label']))
        — {{ $ctx['bc_statut_label'] }}
    @endif
    @if($bonCommande->date_commande)
        — {{ $bonCommande->date_commande->format('d/m/Y') }}
    @endif
</p>

<div class="section">
    <h2>Client</h2>
    <table class="info-grid">
        @if(!empty($client['name']))
        <tr><td>Raison sociale</td><td>{{ $client['name'] }}</td></tr>
        @endif
        @if(!empty($client['address_line']))
        <tr><td>Adresse</td><td>{{ $client['address_line'] }}</td></tr>
        @endif
        @if(!empty($client['ice']))
        <tr><td>ICE</td><td>{{ $client['ice'] }}</td></tr>
        @endif
        @if(!empty($client['rc']))
        <tr><td>RC</td><td>{{ $client['rc'] }}</td></tr>
        @endif
        @if(!empty($client['siret']))
        <tr><td>SIRET</td><td>{{ $client['siret'] }}</td></tr>
        @endif
        @if(!empty($client['email']))
        <tr><td>Email</td><td>{{ $client['email'] }}</td></tr>
        @endif
        @if(!empty($client['phone']))
        <tr><td>Téléphone</td><td>{{ $client['phone'] }}</td></tr>
        @endif
        @if(!empty($client['contact_name']))
        <tr>
            <td>Contact BC</td>
            <td>
                {{ $client['contact_name'] }}
                @if(!empty($client['contact_role'])) — {{ $client['contact_role'] }} @endif
                @if(!empty($client['contact_email']))<br>{{ $client['contact_email'] }}@endif
                @if(!empty($client['contact_phone']))<br>{{ $client['contact_phone'] }}@endif
            </td>
        </tr>
        @endif
    </table>
</div>

<div class="section">
    <h2>Dossier</h2>
    <table class="info-grid">
        @if(!empty($dossier['reference']) || !empty($dossier['titre']))
        <tr>
            <td>Référence</td>
            <td>
                {{ $dossier['reference'] ?? '—' }}
                @if(!empty($dossier['titre'])) — {{ $dossier['titre'] }} @endif
            </td>
        </tr>
        @endif
        @if($showAffaire && !empty($ctx['affaire']))
        <tr><td>Affaire</td><td>{{ $ctx['affaire'] }}</td></tr>
        @endif
        @if(!empty($dossier['statut_label']))
        <tr><td>Statut dossier</td><td>{{ $dossier['statut_label'] }}</td></tr>
        @endif
        @if(!empty($site['name']))
        <tr>
            <td>Chantier</td>
            <td>
                {{ $site['name'] }}
                @if(!empty($site['reference'])) ({{ $site['reference'] }}) @endif
                @if(!empty($site['address']))<br>{{ $site['address'] }}@endif
            </td>
        </tr>
        @endif
        @if(!empty($dossier['mission']))
        <tr><td>Mission</td><td>{{ $dossier['mission'] }}</td></tr>
        @endif
        @if(!empty($dossier['date_debut']) || !empty($dossier['date_fin_prevue']))
        <tr>
            <td>Calendrier</td>
            <td>
                @if(!empty($dossier['date_debut']))Début : {{ $dossier['date_debut'] }}@endif
                @if(!empty($dossier['date_fin_prevue']))
                    @if(!empty($dossier['date_debut'])) — @endif
                    Fin prévue : {{ $dossier['date_fin_prevue'] }}
                @endif
            </td>
        </tr>
        @endif
        @if(!empty($dossier['maitre_ouvrage']))
        <tr><td>Maître d'ouvrage</td><td>{{ $dossier['maitre_ouvrage'] }}</td></tr>
        @endif
        @if(!empty($dossier['entreprise_chantier']))
        <tr><td>Entreprise chantier</td><td>{{ $dossier['entreprise_chantier'] }}</td></tr>
        @endif
        @if(!empty($dossier['notes']))
        <tr><td>Notes dossier</td><td>{{ $dossier['notes'] }}</td></tr>
        @endif
    </table>
</div>

@if($dossierContacts !== [])
<div class="section">
    <h2>Contacts chantier</h2>
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
            @foreach($dossierContacts as $contact)
            <tr>
                <td>{{ $contact['name'] ?? '—' }}</td>
                <td>{{ $contact['role'] ?? '—' }}</td>
                <td>{{ $contact['email'] ?? '—' }}</td>
                <td>{{ $contact['phone'] ?? '—' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endif

<div class="section">
    <h2>Commande</h2>
    @if($showLinkedQuote && $bonCommande->quote)
    <p class="meta">Devis source : {{ $bonCommande->quote->number }}</p>
    @endif
    @if($bonCommande->date_livraison_prevue)
    <p class="meta">Livraison prévue : {{ $bonCommande->date_livraison_prevue->format('d/m/Y') }}</p>
    @endif
    @if(trim((string) ($bonCommande->notes ?? '')) !== '')
    <p class="meta">Notes BC : {{ $bonCommande->notes }}</p>
    @endif

    <table style="margin-top: 10px;">
        <thead>
            <tr>
                @if($showDesignation || $showArticleCode)
                <th>Désignation</th>
                @endif
                @if($showQuantity)
                <th>Qté</th>
                @endif
                @if($showPuPtCols)
                <th>PU HT</th>
                <th class="text-right">Total HT</th>
                @endif
            </tr>
        </thead>
        <tbody>
            @foreach($bonCommande->lignes as $ligne)
            @php
                $articleCode = trim((string) ($ligne->article?->code ?? $ligne->article?->s2g_code ?? ''));
                $lineParts = [];
                if ($showArticleCode && $articleCode !== '') { $lineParts[] = $articleCode; }
                if ($showDesignation && !empty($ligne->libelle)) { $lineParts[] = $ligne->libelle; }
                $lineLabel = $lineParts !== [] ? implode(' — ', $lineParts) : '—';
            @endphp
            <tr>
                @if($showDesignation || $showArticleCode)
                <td>{{ $lineLabel }}</td>
                @endif
                @if($showQuantity)
                <td>{{ $ligne->quantite }}</td>
                @endif
                @if($showPuPtCols)
                <td>{{ $fmt($ligne->prix_unitaire_ht ?? 0) }} {{ $currencyLabel }}</td>
                <td class="text-right">{{ $fmt($ligne->montant_ht ?? 0) }} {{ $currencyLabel }}</td>
                @endif
            </tr>
            @endforeach
        </tbody>
    </table>

    @if($showTotalHt || $showTotalTva || $showTotalTtc)
    <div style="margin-top: 14px; text-align: right;">
        @if($showTotalHt)
        <p>Total HT : {{ $fmt($bonCommande->montant_ht ?? 0) }} {{ $currencyLabel }}</p>
        @endif
        @if($showTotalTva)
        @php $tva = max(0, (float) ($bonCommande->montant_ttc ?? 0) - (float) ($bonCommande->montant_ht ?? 0)); @endphp
        <p>TVA : {{ $fmt($tva) }} {{ $currencyLabel }}</p>
        @endif
        @if($showTotalTtc)
        <p><strong>Total TTC : {{ $fmt($bonCommande->montant_ttc ?? 0) }} {{ $currencyLabel }}</strong></p>
        @endif
    </div>
    @endif
</div>
</body>
</html>
