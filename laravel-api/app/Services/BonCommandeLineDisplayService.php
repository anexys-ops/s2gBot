<?php

namespace App\Services;

use Illuminate\Support\Collection;

final class BonCommandeLineDisplayService
{
    /**
     * Reproduit dans les PDF l'ordre des jalons et de leurs lignes affiché sur la fiche BC.
     *
     * @param  Collection<int, mixed>  $lignes
     * @param  array<string, mixed>  $meta
     * @return list<array<string, mixed>>
     */
    public function build(Collection $lignes, array $meta = []): array
    {
        $sorted = $lignes->sort(function ($a, $b): int {
            $byOrder = ((int) ($a->ordre ?? 0)) <=> ((int) ($b->ordre ?? 0));

            return $byOrder !== 0 ? $byOrder : ((int) $a->id) <=> ((int) $b->id);
        })->values();
        if ($sorted->isEmpty()) {
            return [];
        }

        $jalons = is_array($meta['devis_jalons'] ?? null) ? $meta['devis_jalons'] : [];
        $parcours = is_array($meta['devis_parcours'] ?? null) ? $meta['devis_parcours'] : [];
        if ($jalons === [] && $parcours === []) {
            return $sorted->map(fn ($ligne) => $this->productRow($ligne, false))->all();
        }

        $childRefIds = [];
        $jalonById = [];
        foreach ($jalons as $jalon) {
            if (! is_array($jalon)) {
                continue;
            }
            foreach (($jalon['product_ref_article_ids'] ?? []) as $refId) {
                if ((int) $refId > 0) {
                    $childRefIds[(int) $refId] = true;
                }
            }
            if (! empty($jalon['id'])) {
                $jalonById[(string) $jalon['id']] = $jalon;
            }
        }

        $usedIds = [];
        $forfaitByJalonId = [];
        foreach ($jalonById as $jalonId => $jalon) {
            $forfaitLabel = ! empty($jalon['libelle'])
                ? 'Prestation forfaitaire — '.$jalon['libelle']
                : 'Prestation forfaitaire';
            foreach ($sorted as $ligne) {
                if (isset($usedIds[(int) $ligne->id])) {
                    continue;
                }
                if ((string) ($ligne->libelle ?? '') === $forfaitLabel) {
                    $forfaitByJalonId[$jalonId] = $ligne;
                    $usedIds[(int) $ligne->id] = true;
                    break;
                }
            }
        }

        $rows = [];
        $findByRefId = function (int $refId) use ($sorted, &$usedIds) {
            foreach ($sorted as $ligne) {
                if (isset($usedIds[(int) $ligne->id])) {
                    continue;
                }
                if ((int) ($ligne->ref_article_id ?? 0) === $refId) {
                    return $ligne;
                }
            }

            return null;
        };
        $emitProduct = function ($ligne, bool $nested) use (&$rows, &$usedIds): void {
            $id = (int) $ligne->id;
            if (isset($usedIds[$id])) {
                return;
            }
            $usedIds[$id] = true;
            $rows[] = $this->productRow($ligne, $nested);
        };
        $nextStandalone = function () use ($sorted, &$usedIds, $childRefIds) {
            foreach ($sorted as $ligne) {
                if (isset($usedIds[(int) $ligne->id])) {
                    continue;
                }
                $refId = (int) ($ligne->ref_article_id ?? 0);
                if ($refId > 0 && isset($childRefIds[$refId])) {
                    continue;
                }

                return $ligne;
            }

            return null;
        };
        $emitJalon = function (string $jalonId) use (&$rows, $jalonById, $forfaitByJalonId, $findByRefId, $emitProduct): void {
            $jalon = $jalonById[$jalonId] ?? null;
            if ($jalon === null) {
                return;
            }
            $children = [];
            foreach (($jalon['product_ref_article_ids'] ?? []) as $refId) {
                $ligne = $findByRefId((int) $refId);
                if ($ligne !== null) {
                    $children[] = $ligne;
                }
            }
            $rows[] = [
                'type' => 'jalon_header',
                'key' => 'j-'.$jalonId,
                'label' => (string) ($jalon['libelle'] ?? ''),
                'code' => $jalon['s2g_code'] ?? null,
                'forfait_ligne' => $forfaitByJalonId[$jalonId] ?? null,
            ];
            foreach ($children as $ligne) {
                $emitProduct($ligne, true);
            }
        };

        if ($parcours !== []) {
            foreach ($parcours as $item) {
                if (! is_array($item)) {
                    continue;
                }
                if (($item['kind'] ?? null) === 'jalon') {
                    $emitJalon((string) ($item['id'] ?? ''));
                } else {
                    $ligne = $nextStandalone();
                    if ($ligne !== null) {
                        $emitProduct($ligne, false);
                    }
                }
            }
        } else {
            foreach (array_keys($jalonById) as $jalonId) {
                $emitJalon($jalonId);
            }
        }

        foreach ($sorted as $ligne) {
            if (! isset($usedIds[(int) $ligne->id])) {
                $emitProduct($ligne, false);
            }
        }

        return $rows;
    }

    /** @return array<string, mixed> */
    private function productRow($ligne, bool $nested): array
    {
        return [
            'type' => 'product',
            'key' => 'l-'.$ligne->id,
            'ligne' => $ligne,
            'nested' => $nested,
        ];
    }
}
