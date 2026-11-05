<?php

namespace App\Services;

use App\Models\Sample;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Liste labo des jalons dont la réception est effectuée : au moins un échantillon du jalon a été
 * réceptionné au laboratoire. Un jalon = regroupement de produits du devis (quote.meta.devis_jalons),
 * résolu par ligne de BC via DevisJalonResolver ; une ligne hors jalon forme son propre groupe.
 */
class LabJalonsRecusService
{
    /** Échantillons physiquement présents au labo (réceptionnés, pas annulés / perdus / rejetés). */
    public const RECEIVED_STATUSES = [
        Sample::STATUS_RECEPTIONNE,
        Sample::STATUS_IMPRIME,
        Sample::STATUS_EN_ESSAI,
        Sample::STATUS_TERMINE,
        Sample::STATUS_STOCKE,
        Sample::STATUS_ARCHIVE,
    ];

    /** Statuts pour lesquels l'essai reste à faire. */
    public const TO_PROCESS_STATUSES = [
        Sample::STATUS_RECEPTIONNE,
        Sample::STATUS_IMPRIME,
    ];

    public function __construct(
        private readonly DevisJalonResolver $jalonResolver,
    ) {}

    /** @return Collection<int, array<string, mixed>> */
    public function list(?string $search = null): Collection
    {
        $q = Sample::query()
            ->whereNotNull('received_at')
            ->whereNotNull('bon_commande_ligne_id')
            ->whereIn('status', self::RECEIVED_STATUSES)
            ->with([
                'task:id,pv_numbers',
                'bonCommandeLigne:id,bon_commande_id,ref_article_id,libelle',
                'bonCommandeLigne.bonCommande:id,numero,quote_id,client_id,dossier_id',
                'bonCommandeLigne.bonCommande.quote:id,meta',
                'bonCommandeLigne.bonCommande.client:id,name',
                'bonCommandeLigne.bonCommande.dossier:id,reference,titre,site_id',
                'bonCommandeLigne.bonCommande.dossier.site:id,name',
            ]);

        $search = trim((string) $search);
        $like = '%'.$search.'%';

        $groups = [];
        foreach ($q->orderByDesc('received_at')->get() as $sample) {
            $ligne = $sample->bonCommandeLigne;
            $bc = $ligne?->bonCommande;
            if (! $ligne || ! $bc) {
                continue;
            }
            $jalon = $this->jalonResolver->jalonsForLigne($bc, $ligne)[0] ?? null;
            $key = $bc->id.'|'.($jalon !== null && $jalon['id'] !== '' ? 'j:'.$jalon['id'] : 'l:'.$ligne->id);

            if (! isset($groups[$key])) {
                $dossier = $bc->dossier;
                $groups[$key] = [
                    'key' => $key,
                    'client' => $bc->client ? ['id' => $bc->client->id, 'name' => $bc->client->name] : null,
                    'chantier' => $dossier?->site ? ['id' => $dossier->site->id, 'name' => $dossier->site->name] : null,
                    'dossier' => $dossier ? ['id' => $dossier->id, 'reference' => $dossier->reference, 'titre' => $dossier->titre] : null,
                    'bon_commande' => ['id' => $bc->id, 'numero' => $bc->numero],
                    'jalon' => $jalon !== null
                        ? ['id' => $jalon['id'], 'code' => $jalon['code'], 'label' => $jalon['label']]
                        : null,
                    'libelle' => $jalon !== null
                        ? trim(($jalon['code'] ? $jalon['code'].' — ' : '').$jalon['label'])
                        : $ligne->libelle,
                    'pv_numbers' => [],
                    'numeros_reception' => [],
                    'folds' => [],
                    'echantillons_recus' => 0,
                    'echantillons_a_traiter' => 0,
                    'derniere_reception_at' => $sample->received_at?->toIso8601String(),
                ];
            }

            $g = &$groups[$key];
            $g['echantillons_recus']++;
            if (in_array($sample->status, self::TO_PROCESS_STATUSES, true)) {
                $g['echantillons_a_traiter']++;
            }
            if ($sample->transco_number) {
                $g['numeros_reception'][] = $sample->transco_number;
            }
            if ($sample->fold_number) {
                $g['folds'][] = $sample->fold_number;
            }
            foreach ($sample->task?->pv_numbers ?? [] as $pv) {
                $g['pv_numbers'][] = (string) $pv;
            }
            unset($g);
        }

        return collect($groups)
            ->map(function (array $g) {
                $g['pv_numbers'] = array_values(array_unique($g['pv_numbers']));
                $g['numeros_reception'] = array_values(array_unique($g['numeros_reception']));
                $g['folds'] = array_values(array_unique($g['folds']));

                return $g;
            })
            ->filter(fn (array $g) => $search === '' || $this->matches($g, $search))
            ->values();
    }

    /** @param array<string, mixed> $g */
    private function matches(array $g, string $search): bool
    {
        $haystack = implode(' ', array_filter([
            $g['client']['name'] ?? null,
            $g['chantier']['name'] ?? null,
            $g['dossier']['reference'] ?? null,
            $g['dossier']['titre'] ?? null,
            $g['bon_commande']['numero'] ?? null,
            $g['libelle'],
            implode(' ', $g['pv_numbers']),
            implode(' ', $g['numeros_reception']),
            implode(' ', $g['folds']),
        ]));

        return mb_stripos($haystack, $search) !== false;
    }
}
