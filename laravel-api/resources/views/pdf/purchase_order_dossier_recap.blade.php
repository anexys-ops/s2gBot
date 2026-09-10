<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Récap dossier — {{ $bonCommande->numero }}</title>
    <style>
        @page { size: A4 portrait; margin: 10mm 12mm 12mm; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 9pt;
            color: #000;
            margin: 0;
            padding: 0;
            line-height: 1.35;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td {
            border: 1px solid #000;
            padding: 4px 6px;
            vertical-align: top;
            text-align: left;
        }
        .form-meta {
            text-align: right;
            font-size: 8.5pt;
            margin-bottom: 8px;
        }
        .form-title {
            text-align: center;
            font-size: 12pt;
            font-weight: bold;
            margin: 0 0 12px;
        }
        .section-title {
            font-weight: bold;
            margin: 10px 0 4px;
        }
        .label-row td:first-child {
            width: 18%;
            font-weight: bold;
            background: #f5f5f5;
        }
        .checkbox-grid td {
            width: 25%;
            border: 1px solid #000;
            padding: 4px 6px;
        }
        .checkbox {
            display: inline-block;
            width: 10px;
            height: 10px;
            border: 1px solid #000;
            margin-right: 5px;
            text-align: center;
            line-height: 10px;
            font-size: 8pt;
            vertical-align: middle;
        }
        .checkbox.checked::after {
            content: 'X';
            font-weight: bold;
        }
        .dotted {
            border-bottom: 1px dotted #666;
            min-height: 14px;
            margin: 4px 0;
        }
        .signature-row td {
            padding-top: 10px;
        }
        .muted { color: #444; }
        .nowrap { white-space: nowrap; }
    </style>
</head>
<body>
@php
    $ctx = $pdfContext ?? [];
    $form = is_array($ctx['form'] ?? null) ? $ctx['form'] : [];
    $client = is_array($ctx['client'] ?? null) ? $ctx['client'] : [];
    $contact = is_array($ctx['contact'] ?? null) ? $ctx['contact'] : [];
    $dossier = is_array($ctx['dossier'] ?? null) ? $ctx['dossier'] : [];
    $projet = is_array($ctx['projet'] ?? null) ? $ctx['projet'] : [];
    $devis = is_array($ctx['devis'] ?? null) ? $ctx['devis'] : [];
    $documents = is_array($ctx['documents'] ?? null) ? $ctx['documents'] : [];
    $prestationTypes = is_array($ctx['prestation_types'] ?? null) ? $ctx['prestation_types'] : [];
    $priorite = $ctx['priorite'] ?? null;
    $instructions = trim((string) ($ctx['instructions'] ?? ''));
    $etabliPar = trim((string) ($ctx['etabli_par'] ?? ''));
    $dossierRef = $dossier['reference'] ?? $bonCommande->dossier?->reference ?? $bonCommande->numero;
    $clientAddress = $client['address_line'] ?? null;
    if (!$clientAddress && !empty($client['code'])) {
        $clientAddress = 'Code '.$client['code'];
    }
@endphp

<div class="form-meta">
    {{ $form['reference'] ?? 'En-M-05-12' }}v /v : {{ $form['version'] ?? '02' }}<br>
    Màj:{{ $form['maj_date'] ?? '26/12/2024' }}
</div>

<h1 class="form-title">Dossier N° : {{ $dossierRef }}</h1>

<div class="section-title">1. Information générales sur le client :</div>
<table>
    <tr>
        <th>Nom du client</th>
        <th>Adresse</th>
    </tr>
    <tr>
        <td>{{ $client['name'] ?? '—' }}</td>
        <td>{{ $clientAddress ?? '—' }}</td>
    </tr>
</table>

<table style="margin-top: 6px;">
    <tr>
        <td colspan="2"><strong>Contact principale :</strong></td>
    </tr>
    <tr class="label-row">
        <td>Nom :</td>
        <td>E-mail :</td>
    </tr>
    <tr>
        <td>{{ $contact['name'] ?? '—' }}</td>
        <td>{{ $contact['email'] ?? '—' }}</td>
    </tr>
    <tr class="label-row">
        <td>GSM :</td>
        <td>Fixe :</td>
    </tr>
    <tr>
        <td>{{ $contact['gsm'] ?? '—' }}</td>
        <td>{{ $contact['fixe'] ?? '—' }}</td>
    </tr>
</table>

<div class="section-title">2. Informations sur le projet :</div>
<table>
    <tr class="label-row">
        <td>Projet :</td>
        <td>{{ $projet['description'] ?? ($dossier['titre'] ?? '—') }}</td>
    </tr>
    <tr class="label-row">
        <td>Entreprise/MO :</td>
        <td>
            {{ $projet['entreprise_mo'] ?? '—' }}
            @if(!empty($projet['code']))
                <span class="nowrap"> — Code : {{ $projet['code'] }}</span>
            @endif
        </td>
    </tr>
</table>

<div style="margin-top: 6px;"><strong>Type de prestations</strong></div>
<table class="checkbox-grid">
    @foreach(array_chunk($prestationTypes, 2) as $row)
    <tr>
        @foreach($row as $type)
        <td>
            <span class="checkbox {{ !empty($type['checked']) ? 'checked' : '' }}"></span>
            {{ $type['label'] ?? '' }}
        </td>
        @endforeach
        @if(count($row) === 1)
        <td></td>
        @endif
    </tr>
    @endforeach
</table>

<div class="section-title">3. Détail du dossier</div>
<table>
    <tr>
        <th>Devis N°</th>
        <th>Etablie par :</th>
        <th>Date :</th>
        <th>Date BCC :</th>
    </tr>
    <tr>
        <td>{{ $devis['number'] ?? '—' }}</td>
        <td>{{ $devis['etabli_par'] ?? $etabliPar ?: '—' }}</td>
        <td>{{ $devis['date'] ?? '—' }}</td>
        <td>{{ $devis['date_bcc'] ?? '—' }}</td>
    </tr>
</table>

<table style="margin-top: 6px;">
    <tr>
        <td colspan="4"><strong>Documents inclus dans le dossier :</strong></td>
    </tr>
    <tr>
        <td><span class="checkbox {{ !empty($documents['plans']) ? 'checked' : '' }}"></span> Plans</td>
        <td><span class="checkbox {{ !empty($documents['preliminaires']) ? 'checked' : '' }}"></span> Documents préliminaires</td>
        <td colspan="2"><span class="checkbox {{ !empty($documents['cahier_charges']) ? 'checked' : '' }}"></span> Cahier des charges / Tdr</td>
    </tr>
    <tr>
        <td colspan="4">
            Autres :
            @if(!empty($documents['autres']))
                {{ $documents['autres'] }}
            @else
                .....................................................................
            @endif
        </td>
    </tr>
</table>

<div style="margin-top: 8px;">
    <strong>Priorité et délai :</strong>
    Urgence :
    <span class="checkbox {{ $priorite === 'normale' ? 'checked' : '' }}"></span> Normale
    <span class="checkbox {{ $priorite === 'prioritaire' ? 'checked' : '' }}"></span> Prioritaire
    <span class="checkbox {{ $priorite === 'tres_urgente' ? 'checked' : '' }}"></span> Très urgente
</div>

<div style="margin-top: 8px;"><strong>Observation ou instructions spécifiques :</strong></div>
@if($instructions !== '')
    <div style="margin-top: 4px;">{{ $instructions }}</div>
@else
    <div class="dotted"></div>
    <div class="dotted"></div>
@endif

<table style="margin-top: 10px;" class="signature-row">
    <tr>
        <td colspan="3"><strong>Réception Service Technique</strong></td>
    </tr>
    <tr>
        <td>Nom: ___________________________</td>
        <td>Visa : _______________________</td>
        <td>Date : ___________________</td>
    </tr>
</table>

<div class="section-title">4. Affectation interne :</div>
<table>
    <tr>
        <th>Responsable dossier</th>
        <th>Date d'affectation</th>
        <th>Heure</th>
    </tr>
    <tr>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
    </tr>
</table>

<table style="margin-top: 6px;">
    <tr class="label-row">
        <td>Nom:</td>
        <td>&nbsp;</td>
    </tr>
    <tr class="label-row">
        <td>Fonction :</td>
        <td>&nbsp;</td>
    </tr>
    <tr>
        <td colspan="2">Délai de traitement souhaité : _________________________</td>
    </tr>
</table>

@if($etabliPar !== '')
<div style="margin-top: 12px;"><strong>Etablie par :</strong> {{ $etabliPar }}</div>
@endif
</body>
</html>
