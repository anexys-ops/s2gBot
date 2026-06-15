<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Sample;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Produits attendus en réception laboratoire.
 *
 * Un produit est éligible lorsque :
 *  - le BC est confirmé ou en cours ;
 *  - le dossier est lié à un chantier ;
 *  - la ligne a un technicien terrain affecté.
 *
 * Toutes les lignes sont incluses (essais labo, rapports, texte libre, etc.).
 */
class LabReceptionService
{
    /** @var list<string> */
    public const BC_STATUTS_ELIGIBLES = [
        BonCommande::STATUT_CONFIRME,
        BonCommande::STATUT_EN_COURS,
    ];

    public function eligibleLinesQuery(): Builder
    {
        return BonCommandeLigne::query()
            ->whereNotNull('technicien_id')
            ->whereHas('bonCommande', function (Builder $q) {
                $q->whereIn('statut', self::BC_STATUTS_ELIGIBLES);
            })
            ->whereHas('bonCommande', function (Builder $q) {
                $q->whereNotNull('dossier_id');
            })
            ->whereHas('bonCommande.dossier', function (Builder $q) {
                $q->whereNotNull('site_id');
            });
    }

    /** @return Collection<int, array<string, mixed>> */
    public function listAttendus(?string $search = null): Collection
    {
        $q = $this->eligibleLinesQuery()->with([
            'article:id,code,libelle',
            'technicien:id,name',
            'bonCommande:id,numero,dossier_id,client_id,statut,date_commande',
            'bonCommande.dossier:id,reference,titre,site_id,client_id',
            'bonCommande.dossier.site:id,name',
            'bonCommande.client:id,name',
        ]);

        if ($search = trim((string) $search)) {
            $like = '%'.$search.'%';
            $q->where(function (Builder $inner) use ($like) {
                $inner->where('libelle', 'like', $like)
                    ->orWhereHas('bonCommande', fn (Builder $bc) => $bc->where('numero', 'like', $like))
                    ->orWhereHas('bonCommande.client', fn (Builder $c) => $c->where('name', 'like', $like))
                    ->orWhereHas('bonCommande.dossier', fn (Builder $d) => $d
                        ->where('reference', 'like', $like)
                        ->orWhere('titre', 'like', $like))
                    ->orWhereHas('bonCommande.dossier.site', fn (Builder $s) => $s->where('name', 'like', $like))
                    ->orWhereHas('technicien', fn (Builder $t) => $t->where('name', 'like', $like))
                    ->orWhereHas('article', fn (Builder $a) => $a
                        ->where('code', 'like', $like)
                        ->orWhere('libelle', 'like', $like));
            });
        }

        $lignes = $q->orderByDesc('id')->get();
        $lineIds = $lignes->pluck('id')->all();
        $counts = $this->sampleCountsByLine($lineIds);

        return $lignes->map(function (BonCommandeLigne $ligne) use ($counts) {
            $bc = $ligne->bonCommande;
            $dossier = $bc?->dossier;
            $c = $counts[$ligne->id] ?? ['en_transit' => 0, 'recu' => 0, 'total' => 0];
            $attendu = (int) round((float) $ligne->quantite);

            return [
                'id' => $ligne->id,
                'libelle' => $ligne->libelle,
                'quantite_attendue' => $attendu,
                'quantite_en_transit' => $c['en_transit'],
                'quantite_recue' => $c['recu'],
                'quantite_manquante' => max(0, $attendu - $c['total']),
                'reception_complete' => $attendu > 0 && $c['total'] >= $attendu,
                'article' => $ligne->article ? [
                    'id' => $ligne->article->id,
                    'code' => $ligne->article->code,
                    'libelle' => $ligne->article->libelle,
                ] : null,
                'technicien' => $ligne->technicien ? [
                    'id' => $ligne->technicien->id,
                    'name' => $ligne->technicien->name,
                ] : null,
                'bon_commande' => $bc ? [
                    'id' => $bc->id,
                    'numero' => $bc->numero,
                    'statut' => $bc->statut,
                    'date_commande' => $bc->date_commande?->format('Y-m-d'),
                ] : null,
                'dossier' => $dossier ? [
                    'id' => $dossier->id,
                    'reference' => $dossier->reference,
                    'titre' => $dossier->titre,
                ] : null,
                'chantier' => $dossier?->site ? [
                    'id' => $dossier->site->id,
                    'name' => $dossier->site->name,
                ] : null,
                'client' => $bc?->client ? [
                    'id' => $bc->client->id,
                    'name' => $bc->client->name,
                ] : null,
            ];
        })->values();
    }

    /**
     * @param  list<int>  $lineIds
     * @return array<int, array{en_transit: int, recu: int, total: int}>
     */
    private function sampleCountsByLine(array $lineIds): array
    {
        if ($lineIds === []) {
            return [];
        }

        $rows = Sample::query()
            ->selectRaw('bon_commande_ligne_id, status, COUNT(*) as cnt')
            ->whereIn('bon_commande_ligne_id', $lineIds)
            ->where('status', '!=', Sample::STATUS_REJETE)
            ->groupBy('bon_commande_ligne_id', 'status')
            ->get();

        $out = [];
        foreach ($lineIds as $id) {
            $out[$id] = ['en_transit' => 0, 'recu' => 0, 'total' => 0];
        }

        foreach ($rows as $row) {
            $id = (int) $row->bon_commande_ligne_id;
            $cnt = (int) $row->cnt;
            $out[$id]['total'] += $cnt;
            if ($row->status === Sample::STATUS_EN_TRANSIT) {
                $out[$id]['en_transit'] += $cnt;
            } else {
                $out[$id]['recu'] += $cnt;
            }
        }

        return $out;
    }

    public function isLineEligible(BonCommandeLigne $ligne): bool
    {
        $ligne->loadMissing(['bonCommande.dossier']);

        if (! $ligne->technicien_id) {
            return false;
        }

        $bc = $ligne->bonCommande;
        if (! $bc || ! in_array($bc->statut, self::BC_STATUTS_ELIGIBLES, true)) {
            return false;
        }

        return $bc->dossier_id !== null && $bc->dossier?->site_id !== null;
    }
}
