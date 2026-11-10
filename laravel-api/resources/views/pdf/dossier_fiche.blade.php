<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Dossier {{ $dossier->reference }}</title>
    <style>
        @page { margin: 14mm 12mm; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 9.5px; color: #111; margin: 0; }
        h1 { font-size: 14px; text-align: center; margin: 10px 0 12px; }
        h2 { font-size: 10.5px; margin: 12px 0 4px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #333; padding: 4px 5px; vertical-align: top; }
        .lbl { background: #f9c9a0; font-weight: bold; width: 16%; }
        .lbl-sm { background: #f9c9a0; font-weight: bold; width: 9%; }
        .tall { height: 34px; }
        .box { display: inline-block; width: 8px; height: 8px; border: 1px solid #333; margin-right: 4px; vertical-align: middle; }
        .box.on { background: #333; }
        .noborder td { border: none; padding: 2px 0; }
        .head th { background: #f9c9a0; text-align: center; }
        .line { display: inline-block; border-bottom: 1px solid #333; min-width: 120px; }
        .right { text-align: right; }
        .muted { color: #555; }
    </style>
</head>
<body>
@php
    $client = $dossier->client;
    // Devis de référence : le premier devis du dossier (celui qui l'a ouvert).
    $quote = $dossier->quotes->sortBy('id')->first();
    $bc = $quote?->bonsCommande?->sortBy('id')->first();
    $contact = $quote?->clientContact
        ?? $client?->contacts?->firstWhere('is_principal', true)
        ?? $client?->contacts?->first();
    $dossierContact = $contact ? null : $dossier->contacts->first();
    $contactNom = $contact
        ? trim(($contact->prenom ?? '').' '.($contact->nom ?? ''))
        : ($dossierContact ? trim(($dossierContact->prenom ?? '').' '.($dossierContact->nom ?? '')) : '');
    $contactGsm = $contact?->telephone_mobile ?? $dossierContact?->telephone ?? '';
    $contactFixe = $contact?->telephone_direct ?? '';
    $contactEmail = $contact?->email ?? $dossierContact?->email ?? '';
    $adresse = trim(implode(' ', array_filter([$client?->address, $client?->postal_code, $client?->city])));
    $etabliPar = $dossier->createur?->name ?? '';
    $fmt = fn ($d) => $d ? \Carbon\Carbon::parse($d)->format('d/m/Y') : '';
@endphp

@include('pdf.partials.branding-header', ['layoutConfig' => [], 'brandingLogoDataUri' => $brandingLogoDataUri ?? null])

<h1>Dossier N° : &nbsp; {{ $dossier->reference }}</h1>

<h2>1. Information générales sur le client :</h2>
<table>
    <tr>
        <td class="lbl">Nom du client</td>
        <td>{{ $client?->name }}</td>
        <td class="lbl-sm">Code</td>
        <td style="width:14%">{{ $client?->prolab_code }}</td>
    </tr>
    <tr>
        <td class="lbl">Adresse</td>
        <td colspan="3">{{ $adresse }}</td>
    </tr>
</table>

<h2>Contact principal :</h2>
<table>
    <tr>
        <td class="lbl">Nom :</td>
        <td style="width:40%">{{ $contactNom }}</td>
        <td class="lbl-sm">GSM :</td>
        <td>{{ $contactGsm }}</td>
    </tr>
    <tr>
        <td class="lbl">E-mail :</td>
        <td>{{ $contactEmail }}</td>
        <td class="lbl-sm">Fixe :</td>
        <td>{{ $contactFixe }}</td>
    </tr>
</table>

<h2>2. Informations sur le projet :</h2>
<table>
    <tr>
        <td class="lbl tall">Projet :</td>
        <td colspan="3">{{ $dossier->site?->name ?? $dossier->titre }}</td>
    </tr>
    <tr>
        <td class="lbl">Entreprise/MO :</td>
        <td style="width:40%">{{ collect([$dossier->entreprise_chantier, $dossier->maitre_ouvrage])->filter()->implode(' / ') }}</td>
        <td class="lbl-sm">Code :</td>
        <td>{{ $dossier->site?->reference }}</td>
    </tr>
</table>

<h2>Type de prestations</h2>
<table>
    <tr>
        <td><span class="box"></span>Étude Géotechniques</td>
        <td><span class="box"></span>Essai de laboratoire</td>
        <td><span class="box"></span>Expertise technique</td>
        <td><span class="box"></span>Études spéciales</td>
    </tr>
    <tr>
        <td><span class="box"></span>Contrôle de qualité</td>
        <td><span class="box"></span>Avis technique</td>
        <td><span class="box"></span>Études Géophysique</td>
        <td><span class="box"></span>Recherche du Innovation</td>
    </tr>
</table>

<h2>3. Détail du dossier</h2>
<table>
    <tr>
        <td><strong>Devis N° :</strong> {{ $quote?->number }}</td>
        <td><strong>Etablie par :</strong> {{ $etabliPar }}</td>
        <td><strong>Date :</strong> {{ $fmt($quote?->quote_date) }}</td>
        <td><strong>Date BCC :</strong> {{ $bc ? $fmt($bc->date_commande) : '…/…/….' }}</td>
    </tr>
</table>
<table style="border-top:none">
    <tr>
        <td class="lbl" rowspan="2" style="width:22%">Documents inclus dans le dossier :</td>
        <td><span class="box"></span>Plans</td>
        <td><span class="box"></span>Cahier des charges / Tdr</td>
    </tr>
    <tr>
        <td><span class="box"></span>Documents préliminaires</td>
        <td><span class="box"></span>Autres : ……………………………</td>
    </tr>
    <tr>
        <td class="lbl">Priorité et délai :</td>
        <td colspan="2">
            Urgence : &nbsp;
            <span class="box"></span>Normale &nbsp;&nbsp;
            <span class="box"></span>Prioritaire &nbsp;&nbsp;
            <span class="box"></span>Très urgente
        </td>
    </tr>
</table>

<h2>Observation ou instructions spécifiques :</h2>
<p style="margin:2px 0 8px">{{ $dossier->notes ?: '……………………………………………………………………………………………………………………………………………………' }}</p>

<h2>Réception Service Technique</h2>
<table class="noborder">
    <tr>
        <td>Nom : <span class="line" style="min-width:160px">&nbsp;</span></td>
        <td>Visa : <span class="line" style="min-width:160px">&nbsp;</span></td>
        <td>Date : <span class="line">&nbsp;</span></td>
    </tr>
</table>

<h2>4. Affectation interne :</h2>
<table>
    <tr class="head">
        <th colspan="2" style="width:50%">Responsable dossier</th>
        <th>Date d'affectation</th>
        <th>Heure</th>
    </tr>
    <tr>
        <td class="lbl" style="width:12%">Nom:</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
    </tr>
    <tr>
        <td class="lbl">Fonction :</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
    </tr>
</table>

<p style="margin-top:12px"><strong>Délai de traitement souhaité :</strong> <span class="line" style="min-width:200px">&nbsp;</span></p>

<p class="right" style="margin-top:14px"><strong>Établie par :</strong> {{ $etabliPar }}</p>
</body>
</html>
