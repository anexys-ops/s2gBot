<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\Client;
use App\Models\ClientContact;
use App\Models\Dossier;
use App\Models\DossierContact;

class BonCommandePdfPresentationService
{
    /**
     * @return array<string, mixed>
     */
    public function buildContext(BonCommande $bonCommande): array
    {
        $client = $bonCommande->client;
        $dossier = $bonCommande->dossier;
        $site = $dossier?->site;
        $contact = $bonCommande->clientContact;

        $affaireParts = array_filter([
            $site?->name,
            $dossier?->titre,
        ]);
        $affaire = implode(' — ', $affaireParts);

        return [
            'affaire' => $affaire,
            'client' => $this->formatClientBlock($client, $contact),
            'dossier' => $this->formatDossierBlock($dossier),
            'site' => $this->formatSiteBlock($site),
            'dossier_contacts' => $this->formatDossierContacts($dossier),
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

        return [
            'name' => trim((string) $client->name) ?: null,
            'address_line' => $addressParts !== [] ? implode(', ', $addressParts) : null,
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
