<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\Client;
use App\Models\ClientContact;
use App\Models\Dossier;
use App\Models\DossierContact;
use App\Models\User;

class BonCommandePdfPresentationService
{
    /** @var list<array{key: string, label: string, patterns: list<string>}> */
    private const PRESTATION_TYPES = [
        ['key' => 'etude_geotechniques', 'label' => 'Étude Géotechniques', 'patterns' => ['géotechn', 'geotechn', 'geo sol', 'forage', 'sondage']],
        ['key' => 'essai_laboratoire', 'label' => 'Essai de laboratoire', 'patterns' => ['laboratoire', 'essai', 'analyse', 'proctor', 'cbr', 'granulo']],
        ['key' => 'expertise_technique', 'label' => 'Expertise technique', 'patterns' => ['expertise', 'expert']],
        ['key' => 'etudes_speciales', 'label' => 'Études spéciales', 'patterns' => ['spéciale', 'speciale', 'étude spé', 'etude spe']],
        ['key' => 'controle_qualite', 'label' => 'Contrôle de qualité', 'patterns' => ['contrôle', 'controle', 'qualité', 'qualite', 'qc']],
        ['key' => 'avis_technique', 'label' => 'Avis technique', 'patterns' => ['avis']],
        ['key' => 'etudes_geophysique', 'label' => 'Études Géophysique', 'patterns' => ['géophys', 'geophys', 'sismique', 'radar']],
        ['key' => 'recherche_innovation', 'label' => 'Recherche et Innovation', 'patterns' => ['innovation', 'recherche', 'r&d']],
    ];

    /**
     * @return array<string, mixed>
     */
    public function buildContext(BonCommande $bonCommande): array
    {
        $client = $bonCommande->client;
        $dossier = $bonCommande->dossier;
        $site = $dossier?->site;
        $contact = $bonCommande->clientContact;
        $quote = $bonCommande->quote;
        $quoteMeta = is_array($quote?->meta) ? $quote->meta : [];
        $recapMeta = is_array($quoteMeta['bc_recap'] ?? null) ? $quoteMeta['bc_recap'] : [];

        $affaireParts = array_filter([
            $site?->name,
            $dossier?->titre,
        ]);

        return [
            'form' => [
                'reference' => 'En-M-05-12',
                'version' => '02',
                'maj_date' => '26/12/2024',
            ],
            'affaire' => implode(' — ', $affaireParts),
            'client' => $this->formatClientBlock($client, $contact),
            'contact' => $this->formatContactBlock($contact, $client, $dossier),
            'dossier' => $this->formatDossierBlock($dossier),
            'site' => $this->formatSiteBlock($site),
            'dossier_contacts' => $this->formatDossierContacts($dossier),
            'projet' => $this->formatProjetBlock($dossier, $site, $client),
            'prestation_types' => $this->resolvePrestationTypes($bonCommande, $recapMeta),
            'devis' => $this->formatDevisBlock($quote, $bonCommande),
            'documents' => $this->resolveDocumentsInclus($recapMeta),
            'priorite' => $this->resolvePriorite($recapMeta),
            'instructions' => $this->resolveInstructions($bonCommande, $dossier, $recapMeta),
            'etabli_par' => $this->userShortLabel($bonCommande->relationLoaded('createur') ? $bonCommande->createur : null),
            'bc_statut_label' => $this->bonCommandeStatutLabel((string) $bonCommande->statut),
        ];
    }

    /**
     * @return array<string, string|null>
     */
    private function formatClientBlock(?Client $client, ?ClientContact $contact): array
    {
        if ($client === null) {
            return [
                'name' => null,
                'address_line' => null,
                'code' => null,
                'ice' => null,
                'rc' => null,
                'siret' => null,
                'email' => null,
                'phone' => null,
                'contact_name' => null,
                'contact_role' => null,
                'contact_email' => null,
                'contact_phone' => null,
            ];
        }

        $addressParts = array_filter([
            trim((string) ($client->address ?? '')),
            trim(implode(' ', array_filter([
                trim((string) ($client->postal_code ?? '')),
                trim((string) ($client->city ?? '')),
            ]))),
            trim((string) ($client->country ?? '')),
        ]);

        $contactName = null;
        $contactRole = null;
        $contactEmail = null;
        $contactPhone = null;
        if ($contact !== null) {
            $contactName = trim(implode(' ', array_filter([
                trim((string) ($contact->prenom ?? '')),
                trim((string) ($contact->nom ?? '')),
            ])));
            $contactRole = trim((string) ($contact->poste ?? '')) ?: null;
            $contactEmail = trim((string) ($contact->email ?? '')) ?: null;
            $contactPhone = trim((string) ($contact->telephone_mobile ?? $contact->telephone_direct ?? '')) ?: null;
        }

        $clientCode = trim((string) ($client->prolab_code ?? '')) ?: null;

        return [
            'name' => trim((string) $client->name) ?: null,
            'address_line' => $addressParts !== [] ? implode(', ', $addressParts) : null,
            'code' => $clientCode,
            'ice' => trim((string) ($client->ice ?? '')) ?: null,
            'rc' => trim((string) ($client->rc ?? '')) ?: null,
            'siret' => trim((string) ($client->siret ?? '')) ?: null,
            'email' => trim((string) ($client->email ?? '')) ?: null,
            'phone' => trim((string) ($client->phone ?? $client->whatsapp ?? '')) ?: null,
            'contact_name' => $contactName !== '' ? $contactName : null,
            'contact_role' => $contactRole,
            'contact_email' => $contactEmail,
            'contact_phone' => $contactPhone,
        ];
    }

    /**
     * @return array{name: string|null, email: string|null, gsm: string|null, fixe: string|null}
     */
    private function formatContactBlock(?ClientContact $contact, ?Client $client, ?Dossier $dossier): array
    {
        if ($contact !== null) {
            $name = trim(implode(' ', array_filter([
                trim((string) ($contact->prenom ?? '')),
                trim((string) ($contact->nom ?? '')),
            ])));

            return [
                'name' => $name !== '' ? $name : null,
                'email' => trim((string) ($contact->email ?? '')) ?: null,
                'gsm' => trim((string) ($contact->telephone_mobile ?? '')) ?: null,
                'fixe' => trim((string) ($contact->telephone_direct ?? '')) ?: null,
            ];
        }

        if ($dossier !== null && $dossier->relationLoaded('contacts')) {
            foreach ($dossier->contacts as $dossierContact) {
                if (! $dossierContact instanceof DossierContact) {
                    continue;
                }
                $name = trim(implode(' ', array_filter([
                    trim((string) ($dossierContact->prenom ?? '')),
                    trim((string) ($dossierContact->nom ?? '')),
                ])));
                if ($name === '') {
                    continue;
                }

                return [
                    'name' => $name,
                    'email' => trim((string) ($dossierContact->email ?? '')) ?: null,
                    'gsm' => trim((string) ($dossierContact->telephone ?? '')) ?: null,
                    'fixe' => null,
                ];
            }
        }

        return [
            'name' => $client !== null ? trim((string) $client->name) ?: null : null,
            'email' => $client !== null ? trim((string) ($client->email ?? '')) ?: null : null,
            'gsm' => $client !== null ? trim((string) ($client->phone ?? $client->whatsapp ?? '')) ?: null : null,
            'fixe' => null,
        ];
    }

    /**
     * @return array<string, string|null>
     */
    private function formatDossierBlock(?Dossier $dossier): array
    {
        if ($dossier === null) {
            return [
                'reference' => null,
                'titre' => null,
                'statut_label' => null,
                'date_debut' => null,
                'date_fin_prevue' => null,
                'maitre_ouvrage' => null,
                'entreprise_chantier' => null,
                'notes' => null,
                'mission' => null,
            ];
        }

        $missionLabel = null;
        if ($dossier->relationLoaded('mission') && $dossier->mission !== null) {
            $missionLabel = trim($dossier->mission->reference.''
                .($dossier->mission->title ? ' — '.$dossier->mission->title : ''));
        }

        return [
            'reference' => trim((string) ($dossier->reference ?? '')) ?: null,
            'titre' => trim((string) ($dossier->titre ?? '')) ?: null,
            'statut_label' => $this->dossierStatutLabel((string) $dossier->statut),
            'date_debut' => $dossier->date_debut?->format('d/m/Y'),
            'date_fin_prevue' => $dossier->date_fin_prevue?->format('d/m/Y'),
            'maitre_ouvrage' => trim((string) ($dossier->maitre_ouvrage ?? '')) ?: null,
            'entreprise_chantier' => trim((string) ($dossier->entreprise_chantier ?? '')) ?: null,
            'notes' => trim((string) ($dossier->notes ?? '')) ?: null,
            'mission' => $missionLabel !== '' ? $missionLabel : null,
        ];
    }

    /**
     * @return array{description: string|null, entreprise_mo: string|null, code: string|null}
     */
    private function formatProjetBlock(?Dossier $dossier, $site, ?Client $client): array
    {
        $descriptionParts = array_filter([
            trim((string) ($dossier?->titre ?? '')),
            trim((string) ($site?->address ?? '')),
            trim((string) ($site?->name ?? '')),
        ]);

        $codeParts = array_filter([
            trim((string) ($client?->prolab_code ?? '')),
            trim((string) ($site?->reference ?? '')),
        ]);

        $entrepriseMo = trim((string) ($dossier?->maitre_ouvrage ?? ''));
        if ($entrepriseMo === '') {
            $entrepriseMo = trim((string) ($dossier?->entreprise_chantier ?? '')) ?: null;
        }

        return [
            'description' => $descriptionParts !== [] ? implode(' — ', $descriptionParts) : null,
            'entreprise_mo' => $entrepriseMo !== '' ? $entrepriseMo : null,
            'code' => $codeParts !== [] ? implode('/', $codeParts) : null,
        ];
    }

    /**
     * @return array<string, string|null>
     */
    private function formatSiteBlock($site): array
    {
        if ($site === null) {
            return [
                'name' => null,
                'address' => null,
                'reference' => null,
            ];
        }

        return [
            'name' => trim((string) ($site->name ?? '')) ?: null,
            'address' => trim((string) ($site->address ?? '')) ?: null,
            'reference' => trim((string) ($site->reference ?? '')) ?: null,
        ];
    }

    /**
     * @return list<array{name: string, role: string|null, email: string|null, phone: string|null}>
     */
    private function formatDossierContacts(?Dossier $dossier): array
    {
        if ($dossier === null || ! $dossier->relationLoaded('contacts')) {
            return [];
        }

        $rows = [];
        foreach ($dossier->contacts as $contact) {
            if (! $contact instanceof DossierContact) {
                continue;
            }
            $name = trim(implode(' ', array_filter([
                trim((string) ($contact->prenom ?? '')),
                trim((string) ($contact->nom ?? '')),
            ])));
            if ($name === '') {
                continue;
            }
            $rows[] = [
                'name' => $name,
                'role' => trim((string) ($contact->role ?? '')) ?: null,
                'email' => trim((string) ($contact->email ?? '')) ?: null,
                'phone' => trim((string) ($contact->telephone ?? '')) ?: null,
            ];
        }

        return $rows;
    }

    /**
     * @return array{number: string|null, etabli_par: string|null, date: string|null, date_bcc: string|null}
     */
    private function formatDevisBlock($quote, BonCommande $bonCommande): array
    {
        return [
            'number' => $quote !== null ? trim((string) $quote->number) ?: null : null,
            'etabli_par' => $this->userShortLabel($bonCommande->relationLoaded('createur') ? $bonCommande->createur : null),
            'date' => $quote?->quote_date?->format('d/m/Y'),
            'date_bcc' => $bonCommande->date_commande?->format('d/m/Y'),
        ];
    }

    /**
     * @param  array<string, mixed>  $recapMeta
     * @return list<array{key: string, label: string, checked: bool}>
     */
    private function resolvePrestationTypes(BonCommande $bonCommande, array $recapMeta): array
    {
        $explicit = $recapMeta['prestation_types'] ?? null;
        $haystack = mb_strtolower($this->buildPrestationHaystack($bonCommande));

        $rows = [];
        foreach (self::PRESTATION_TYPES as $type) {
            $checked = false;
            if (is_array($explicit)) {
                $checked = in_array($type['key'], $explicit, true);
            } else {
                foreach ($type['patterns'] as $pattern) {
                    if ($pattern !== '' && str_contains($haystack, mb_strtolower($pattern))) {
                        $checked = true;
                        break;
                    }
                }
            }
            $rows[] = [
                'key' => $type['key'],
                'label' => $type['label'],
                'checked' => $checked,
            ];
        }

        return $rows;
    }

    private function buildPrestationHaystack(BonCommande $bonCommande): string
    {
        $parts = [
            (string) ($bonCommande->dossier?->titre ?? ''),
            (string) ($bonCommande->dossier?->notes ?? ''),
            (string) ($bonCommande->notes ?? ''),
        ];

        foreach ($bonCommande->lignes as $ligne) {
            $parts[] = (string) ($ligne->libelle ?? '');
            $parts[] = (string) ($ligne->article?->libelle ?? '');
            $parts[] = (string) ($ligne->article?->famille?->libelle ?? '');
        }

        $quoteMeta = is_array($bonCommande->quote?->meta) ? $bonCommande->quote->meta : [];
        foreach ($quoteMeta['devis_jalons'] ?? [] as $jalon) {
            if (is_array($jalon)) {
                $parts[] = (string) ($jalon['libelle'] ?? '');
            }
        }

        return implode(' ', $parts);
    }

    /**
     * @param  array<string, mixed>  $recapMeta
     * @return array{plans: bool, preliminaires: bool, cahier_charges: bool, autres: string|null}
     */
    private function resolveDocumentsInclus(array $recapMeta): array
    {
        $documents = is_array($recapMeta['documents'] ?? null) ? $recapMeta['documents'] : [];

        return [
            'plans' => (bool) ($documents['plans'] ?? false),
            'preliminaires' => (bool) ($documents['preliminaires'] ?? false),
            'cahier_charges' => (bool) ($documents['cahier_charges'] ?? false),
            'autres' => trim((string) ($documents['autres'] ?? '')) ?: null,
        ];
    }

    /**
     * @param  array<string, mixed>  $recapMeta
     */
    private function resolvePriorite(array $recapMeta): ?string
    {
        $priorite = trim((string) ($recapMeta['priorite'] ?? ''));

        return in_array($priorite, ['normale', 'prioritaire', 'tres_urgente'], true) ? $priorite : null;
    }

    /**
     * @param  array<string, mixed>  $recapMeta
     */
    private function resolveInstructions(BonCommande $bonCommande, ?Dossier $dossier, array $recapMeta): ?string
    {
        $fromMeta = trim((string) ($recapMeta['instructions'] ?? ''));
        if ($fromMeta !== '') {
            return $fromMeta;
        }

        $notes = trim((string) ($bonCommande->notes ?? ''));
        if ($notes !== '') {
            return $notes;
        }

        $dossierNotes = trim((string) ($dossier?->notes ?? ''));

        return $dossierNotes !== '' ? $dossierNotes : null;
    }

    private function userShortLabel(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }

        $email = trim((string) $user->email);
        if ($email !== '' && str_contains($email, '@')) {
            return explode('@', $email, 2)[0];
        }

        return trim((string) $user->name) ?: null;
    }

    public function bonCommandeStatutLabel(string $statut): string
    {
        return match ($statut) {
            'brouillon' => 'Brouillon',
            'confirme' => 'Confirmé',
            'en_cours' => 'En cours',
            'livre' => 'Livré',
            'annule' => 'Annulé',
            default => $statut,
        };
    }

    public function dossierStatutLabel(string $statut): string
    {
        return match ($statut) {
            'brouillon' => 'Brouillon',
            'en_cours' => 'En cours',
            'cloture' => 'Clôturé',
            'archive' => 'Archivé',
            default => $statut,
        };
    }
}
