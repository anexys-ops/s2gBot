<?php

namespace App\Services;

use App\Models\BonLivraison;
use App\Models\BonLivraisonLigne;
use Illuminate\Support\Collection;

class BonLivraisonDeliveryService
{
    /** @var list<string> */
    public const DELIVERED_STATUTS = [
        BonLivraison::STATUT_LIVRE,
        BonLivraison::STATUT_SIGNE,
    ];

    public function deliveredQtyForBcLigne(int $bcLigneId, ?int $excludeBlId = null): float
    {
        $q = BonLivraisonLigne::query()
            ->where('bon_commande_ligne_id', $bcLigneId)
            ->whereHas('bonLivraison', function ($bl) use ($excludeBlId) {
                $bl->whereIn('statut', self::DELIVERED_STATUTS);
                if ($excludeBlId !== null) {
                    $bl->where('id', '!=', $excludeBlId);
                }
            });

        return (float) $q->sum('quantite_livree');
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function enrichLignes(BonLivraison $bl): array
    {
        $bl->loadMissing(['lignes.bonCommandeLigne']);

        return $bl->lignes
            ->map(function (BonLivraisonLigne $ligne) use ($bl) {
                $arr = $ligne->toArray();
                $commandee = (float) ($ligne->bonCommandeLigne?->quantite ?? 0);
                $dejaLivree = $ligne->bon_commande_ligne_id
                    ? $this->deliveredQtyForBcLigne((int) $ligne->bon_commande_ligne_id, (int) $bl->id)
                    : 0.0;
                $restante = max(0.0, $commandee - $dejaLivree);

                $arr['quantite_commandee'] = $commandee;
                $arr['quantite_deja_livree'] = $dejaLivree;
                $arr['quantite_restante'] = $restante;

                return $arr;
            })
            ->values()
            ->all();
    }

    /**
     * @param  list<array{id: int|string, quantite_livree: float|int|string}>  $lignesRows
     */
    public function validateLigneQuantities(BonLivraison $bl, array $lignesRows): ?string
    {
        $bl->loadMissing(['lignes.bonCommandeLigne']);
        /** @var Collection<int, BonLivraisonLigne> $byId */
        $byId = $bl->lignes->keyBy('id');

        foreach ($lignesRows as $row) {
            $ligne = $byId->get((int) $row['id']);
            if ($ligne === null) {
                continue;
            }

            $qty = (float) $row['quantite_livree'];
            $restante = $this->remainingQtyForBlLigne($ligne, (int) $bl->id);

            if ($qty > $restante + 1e-9) {
                $restanteLabel = $this->formatQty($restante);

                return "La quantité livrée pour « {$ligne->libelle} » dépasse le reste à livrer ({$restanteLabel}).";
            }
        }

        return null;
    }

    public function remainingQtyForBlLigne(BonLivraisonLigne $ligne, int $excludeBlId): float
    {
        $commandee = (float) ($ligne->bonCommandeLigne?->quantite ?? 0);
        $dejaLivree = $ligne->bon_commande_ligne_id
            ? $this->deliveredQtyForBcLigne((int) $ligne->bon_commande_ligne_id, $excludeBlId)
            : 0.0;

        return max(0.0, $commandee - $dejaLivree);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function siblingBonsLivraison(BonLivraison $bl): array
    {
        if ($bl->bon_commande_id === null) {
            return [];
        }

        return BonLivraison::query()
            ->where('bon_commande_id', $bl->bon_commande_id)
            ->where('id', '!=', $bl->id)
            ->orderBy('id')
            ->get(['id', 'numero', 'statut', 'date_livraison'])
            ->map(function (BonLivraison $other) {
                $arr = $other->toArray();

                return [
                    'id' => $arr['id'],
                    'numero' => $arr['numero'],
                    'statut' => $arr['statut'],
                    'date_livraison' => $arr['date_livraison'] ?? null,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function formatBonLivraison(BonLivraison $bl, array $relations = ['lignes', 'dossier', 'client', 'clientContact', 'bonCommande']): array
    {
        $bl->loadMissing($relations);
        $payload = $bl->toArray();
        $payload['lignes'] = $this->enrichLignes($bl);
        $payload['autres_bons_livraison'] = $this->siblingBonsLivraison($bl);

        return $payload;
    }

    private function formatQty(float $qty): string
    {
        if (abs($qty - round($qty)) < 1e-9) {
            return (string) (int) round($qty);
        }

        return rtrim(rtrim(number_format($qty, 3, '.', ''), '0'), '.');
    }
}
