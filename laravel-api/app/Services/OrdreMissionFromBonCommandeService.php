<?php

namespace App\Services;

use App\Models\ArticleAction;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Génère / resynchronise les ordres de mission (labo, technicien, ingénieur)
 * à partir d'un bon de commande et crée les mission_tasks associées.
 */
class OrdreMissionFromBonCommandeService
{
    private const WITH = [
        'client:id,name',
        'site:id,name',
        'responsable:id,name',
        'bonCommande:id,numero',
        'lignes.assignedUser:id,name',
        'lignes.equipment:id,name,code',
        'lignes.articleAction',
        'lignes.article:id,code,libelle',
        'lignes.bonCommandeLigne:id,libelle,technicien_id,date_debut_prevue,date_fin_prevue',
    ];

    /** @return list<OrdreMission> */
    public function generate(BonCommande $bc, User $actor): array
    {
        $bc->load([
            'lignes.article.actions',
            'lignes.article.jalonProductLinks.jalon.actions',
            'lignes.article.productJalonLinks.jalon.actions',
            'dossier',
        ]);

        return DB::transaction(function () use ($bc, $actor) {
            $this->purgeExistingForBonCommande($bc);

            $created = [];

            foreach ([OrdreMission::TYPE_LABO, OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR] as $type) {
                $entries = $this->collectEntriesForType($bc, $type);
                if ($entries->isEmpty()) {
                    continue;
                }

                $om = OrdreMission::query()->create([
                    'numero' => OrdreMission::nextNumero($type),
                    'bon_commande_id' => $bc->id,
                    'dossier_id' => $bc->dossier_id,
                    'client_id' => $bc->client_id,
                    'site_id' => $bc->dossier?->site_id,
                    'type' => $type,
                    'statut' => OrdreMission::STATUT_BROUILLON,
                    'date_prevue' => $this->defaultOmDate($bc, $entries),
                    'created_by' => $actor->id,
                ]);

                $ordre = 0;
                foreach ($entries as $entry) {
                    /** @var BonCommandeLigne $ligne */
                    $ligne = $entry['ligne'];
                    /** @var ArticleAction|null $action */
                    $action = $entry['action'];

                    $omLigne = OrdreMissionLigne::query()->create([
                        'ordre_mission_id' => $om->id,
                        'bon_commande_ligne_id' => $ligne->id,
                        'ref_article_id' => $ligne->ref_article_id,
                        'article_action_id' => $action?->id,
                        'libelle' => $action?->libelle ?? $ligne->libelle,
                        'quantite' => $ligne->quantite,
                        'statut' => 'a_faire',
                        'assigned_user_id' => $ligne->technicien_id,
                        'date_prevue' => $ligne->date_debut_prevue,
                        'ordre' => $ordre++,
                    ]);

                    $task = $omLigne->ensureTaskExists();
                    if ($ligne->technicien_id && ! $task->assigned_user_id) {
                        $task->update(['assigned_user_id' => $ligne->technicien_id]);
                    }
                    if ($ligne->date_debut_prevue && ! $task->planned_date) {
                        $task->update([
                            'planned_date' => $ligne->date_debut_prevue->format('Y-m-d'),
                            'due_date' => $ligne->date_fin_prevue?->format('Y-m-d') ?? $ligne->date_debut_prevue->format('Y-m-d'),
                        ]);
                    }
                }

                $created[] = $om->load(self::WITH);
            }

            return $created;
        });
    }

    private function purgeExistingForBonCommande(BonCommande $bc): void
    {
        $existing = OrdreMission::query()->where('bon_commande_id', $bc->id)->get();
        foreach ($existing as $om) {
            $om->delete();
        }
    }

    /**
     * @return Collection<int, array{ligne: BonCommandeLigne, action: ArticleAction|null}>
     */
    private function collectEntriesForType(BonCommande $bc, string $type): Collection
    {
        $entries = collect();

        foreach ($bc->lignes as $ligne) {
            $actions = $this->resolveActionsForLigne($ligne, $type);

            if ($actions->isNotEmpty()) {
                foreach ($actions as $action) {
                    $entries->push(['ligne' => $ligne, 'action' => $action]);
                }

                continue;
            }

            if ($type === OrdreMission::TYPE_TECHNICIEN && $this->ligneEligibleTechnicienFallback($ligne)) {
                $entries->push(['ligne' => $ligne, 'action' => null]);
            }
        }

        return $entries;
    }

    /**
     * @return Collection<int, ArticleAction>
     */
    private function resolveActionsForLigne(BonCommandeLigne $ligne, string $type): Collection
    {
        $article = $ligne->article;
        if (! $article) {
            return collect();
        }

        $direct = $article->actions->where('type', $type)->values();
        if ($direct->isNotEmpty()) {
            return $direct;
        }

        if ($this->articleTriggersOm($article, $type)) {
            return collect([
                new ArticleAction([
                    'type' => $type,
                    'libelle' => $article->libelle,
                    'ordre' => 0,
                ]),
            ]);
        }

        if ($article->isProduct()) {
            foreach ($article->productJalonLinks as $link) {
                $jalon = $link->jalon;
                if (! $jalon) {
                    continue;
                }
                $jalon->loadMissing('actions');
                $jalonActions = $jalon->actions->where('type', $type)->values();
                if ($jalonActions->isNotEmpty()) {
                    return $jalonActions;
                }
                if ($this->articleTriggersOm($jalon, $type)) {
                    return collect([
                        new ArticleAction([
                            'type' => $type,
                            'libelle' => $jalon->libelle,
                            'ordre' => 0,
                        ]),
                    ]);
                }
            }
        }

        if ($article->isJalon()) {
            foreach ($article->jalonProductLinks as $link) {
                $product = $link->product;
                if (! $product) {
                    continue;
                }
                $product->loadMissing('actions');
                $productActions = $product->actions->where('type', $type)->values();
                if ($productActions->isNotEmpty()) {
                    return $productActions;
                }
            }
        }

        return collect();
    }

    private function articleTriggersOm(Article $article, string $type): bool
    {
        return match ($type) {
            OrdreMission::TYPE_TECHNICIEN => (bool) $article->triggers_odm_terrain,
            OrdreMission::TYPE_LABO => (bool) $article->triggers_odm_labo,
            OrdreMission::TYPE_INGENIEUR => (bool) $article->triggers_odm_ingenieur,
            default => false,
        };
    }

    private function ligneEligibleTechnicienFallback(BonCommandeLigne $ligne): bool
    {
        if ($ligne->technicien_id && $ligne->date_debut_prevue) {
            return true;
        }

        return trim((string) $ligne->libelle) !== '';
    }

    /**
     * @param  Collection<int, array{ligne: BonCommandeLigne, action: ArticleAction|null}>  $entries
     */
    private function defaultOmDate(BonCommande $bc, Collection $entries): ?string
    {
        $fromLigne = $entries
            ->map(fn (array $e) => $e['ligne']->date_debut_prevue?->format('Y-m-d'))
            ->filter()
            ->sort()
            ->first();

        return $fromLigne
            ?? $bc->date_livraison_prevue?->format('Y-m-d')
            ?? now()->toDateString();
    }
}
