<?php

namespace App\Services;

use App\Models\ArticleAction;
use App\Models\ArticleSectionProduct;
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
            'lignes.article.sectionProducts.productArticle.actions',
            'lignes.article.jalonProductLinks.product.actions',
            'lignes.article.productJalonLinks.jalon.actions',
            'dossier',
        ]);

        return DB::transaction(function () use ($bc, $actor) {
            // Serialize concurrent clicks for the same BC before checking covered quantities.
            BonCommande::query()->whereKey($bc->id)->lockForUpdate()->firstOrFail();
            $orders = [];

            foreach ([OrdreMission::TYPE_LABO, OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR] as $type) {
                $existing = OrdreMission::query()
                    ->where('bon_commande_id', $bc->id)
                    ->where('type', $type)
                    ->where('statut', '!=', OrdreMission::STATUT_ANNULE)
                    ->with('lignes')
                    ->get();
                foreach ($existing as $om) {
                    $orders[] = $om->load(self::WITH);
                }

                $entries = $this->remainingEntries($this->collectEntriesForType($bc, $type), $existing);
                if ($entries->isEmpty()) {
                    continue;
                }

                $om = OrdreMission::query()->create([
                    'numero' => OrdreMission::nextNumero($type),
                    'bon_commande_id' => $bc->id,
                    'dossier_id' => $bc->dossier_id,
                    'lab_centre_group_id' => $bc->lab_centre_group_id,
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
                        'ref_article_id' => $action?->ref_article_id ?? $ligne->ref_article_id,
                        'article_action_id' => $action?->id,
                        'libelle' => $action?->libelle ?? $ligne->libelle,
                        'quantite' => $entry['quantite'],
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

                $orders[] = $om->load(self::WITH);
            }

            return $orders;
        });
    }

    /**
     * Each catalogue child entry is one task, even when the parent BC jalon has
     * a larger quantity. Standalone BC lines use their own quantity as the
     * number of unit tasks. Existing tasks consume that allocation.
     *
     * @param Collection<int, array{ligne: BonCommandeLigne, action: ArticleAction|null}> $entries
     * @param Collection<int, OrdreMission> $existing
     * @return Collection<int, array{ligne: BonCommandeLigne, action: ArticleAction|null, quantite: float}>
     */
    private function remainingEntries(Collection $entries, Collection $existing): Collection
    {
        $key = static fn (BonCommandeLigne $ligne, ?ArticleAction $action): string => implode(':', [
            $ligne->id,
            $action?->ref_article_id ?? $ligne->ref_article_id ?? 0,
            $action?->id ?? 0,
        ]);
        $unitsForEntry = static function (BonCommandeLigne $ligne, ?ArticleAction $action): float {
            if ($ligne->article?->isJalon() && $action?->ref_article_id !== $ligne->ref_article_id) {
                return 1;
            }

            return max(0, (float) $ligne->quantite);
        };
        $remaining = [];
        foreach ($entries as $entry) {
            $id = $key($entry['ligne'], $entry['action']);
            $remaining[$id] = ($remaining[$id] ?? 0) + $unitsForEntry($entry['ligne'], $entry['action']);
        }
        foreach ($existing as $om) {
            foreach ($om->lignes as $omLigne) {
                $id = implode(':', [
                    $omLigne->bon_commande_ligne_id,
                    $omLigne->ref_article_id ?? 0,
                    $omLigne->article_action_id ?? 0,
                ]);
                if (isset($remaining[$id])) {
                    $remaining[$id] -= max(0, (float) $omLigne->quantite);
                }
            }
        }

        return $entries->flatMap(function (array $entry) use (&$remaining, $key, $unitsForEntry): array {
            $id = $key($entry['ligne'], $entry['action']);
            $quantity = min($unitsForEntry($entry['ligne'], $entry['action']), max(0, $remaining[$id]));
            $remaining[$id] -= $quantity;

            $tasks = [];
            while ($quantity > 0.000001) {
                $unit = min(1, $quantity);
                $tasks[] = [...$entry, 'quantite' => $unit];
                $quantity -= $unit;
            }

            return $tasks;
        })->values();
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

        // Ligne jalon : sous-produits par section en priorité ; sinon actions legacy sur le jalon.
        if ($article->isJalon()) {
            $article->loadMissing(['sectionProducts']);
            $fromProducts = $this->collectProductActionsForJalon($article, $type);
            if ($fromProducts->isNotEmpty()) {
                return $fromProducts;
            }

            // Catalogue structuré par sections : pas de repli sur les actions du jalon parent.
            if ($article->sectionProducts->isNotEmpty()) {
                return collect();
            }

            $direct = $article->actions->where('type', $type)->values();
            if ($direct->isNotEmpty()) {
                return $direct;
            }

            if ($this->articleTriggersOm($article, $type)) {
                return collect([
                    $this->syntheticAction($article, $type),
                ]);
            }

            return collect();
        }

        // The product's configured profile takes precedence over legacy actions
        // and jalon links, which may still reference it from another profile.
        if ($article->isProduct() && ! $this->productAllowsType($article, $type)) {
            return collect();
        }

        $direct = $article->actions->where('type', $type)->values();
        if ($direct->isNotEmpty()) {
            return $direct;
        }

        // Some catalogue products own their technician/engineer/lab sections directly.
        // A section assignment is a task even when no explicit ArticleAction exists.
        if ($article->isProduct()) {
            $article->loadMissing('sectionProducts.productArticle.actions');
            if ($article->sectionProducts->isNotEmpty()) {
                return $this->collectProductActionsForJalon($article, $type);
            }
        }

        if ($this->articleTriggersOm($article, $type)) {
            return collect([
                $this->syntheticAction($article, $type),
            ]);
        }

        if ($article->isProduct()) {
            $fromJalonSection = $this->collectActionsForProductViaJalonSections($article, $type);
            if ($fromJalonSection->isNotEmpty()) {
                return $fromJalonSection;
            }

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
                        $this->syntheticAction($jalon, $type),
                    ]);
                }
            }
        }

        return collect();
    }

    /**
     * Ligne BC = produit (cas fréquent depuis devis) : respecter l'affectation section du jalon parent.
     *
     * @return Collection<int, ArticleAction>
     */
    private function collectActionsForProductViaJalonSections(Article $product, string $type): Collection
    {
        $sectionType = match ($type) {
            OrdreMission::TYPE_TECHNICIEN => ArticleSectionProduct::SECTION_TECHNICIEN,
            OrdreMission::TYPE_LABO => ArticleSectionProduct::SECTION_LABO,
            OrdreMission::TYPE_INGENIEUR => ArticleSectionProduct::SECTION_INGENIEUR,
            default => null,
        };

        if ($sectionType === null) {
            return collect();
        }

        $product->loadMissing(['productJalonLinks.jalon.sectionProducts', 'actions']);

        foreach ($product->productJalonLinks as $link) {
            $jalon = $link->jalon;
            if (! $jalon) {
                continue;
            }

            $inSection = $jalon->sectionProducts->contains(
                fn (ArticleSectionProduct $row) => $row->product_article_id === $product->id
                    && $row->section_type === $sectionType
            );

            if (! $inSection) {
                continue;
            }

            $productActions = $product->actions->where('type', $type)->values();
            if ($productActions->isNotEmpty()) {
                return $productActions;
            }

            if ($this->articleTriggersOm($product, $type)) {
                return collect([
                    $this->syntheticAction($product, $type),
                ]);
            }

            return collect([
                $this->syntheticAction($product, $type),
            ]);
        }

        return collect();
    }

    /**
     * Une tâche OdM par sous-produit (section OdM ou produits rattachés au jalon).
     *
     * @return Collection<int, ArticleAction>
     */
    private function collectProductActionsForJalon(Article $jalon, string $type): Collection
    {
        $sectionType = match ($type) {
            OrdreMission::TYPE_TECHNICIEN => ArticleSectionProduct::SECTION_TECHNICIEN,
            OrdreMission::TYPE_LABO => ArticleSectionProduct::SECTION_LABO,
            OrdreMission::TYPE_INGENIEUR => ArticleSectionProduct::SECTION_INGENIEUR,
            default => null,
        };

        $jalon->loadMissing(['sectionProducts.productArticle.actions', 'jalonProductLinks.product.actions']);

        // [product, quantite] pairs — quantite from section product drives how many OM lignes are created.
        $productEntries = collect();

        if ($sectionType !== null) {
            foreach ($jalon->sectionProducts->where('section_type', $sectionType)->sortBy('ordre') as $row) {
                if ($row->productArticle) {
                    $productEntries->push([
                        'product' => $row->productArticle,
                        'quantite' => max(1, (int) ($row->quantite ?? 1)),
                    ]);
                }
            }
        }

        // Sans sections catalogue : tous les sous-produits du jalon (legacy).
        if ($productEntries->isEmpty() && $jalon->sectionProducts->isEmpty()) {
            foreach ($jalon->jalonProductLinks->sortBy('ordre') as $link) {
                if ($link->product && $this->productAllowsType($link->product, $type)) {
                    $productEntries->push(['product' => $link->product, 'quantite' => 1]);
                }
            }
        }

        $actions = collect();
        foreach ($productEntries as ['product' => $product, 'quantite' => $quantite]) {
            $productActions = $product->actions->where('type', $type)->values();
            if ($productActions->isNotEmpty()) {
                foreach ($productActions as $action) {
                    for ($i = 0; $i < $quantite; $i++) {
                        $actions->push($action);
                    }
                }

                continue;
            }

            for ($i = 0; $i < $quantite; $i++) {
                $actions->push($this->syntheticAction($product, $type));
            }
        }

        return $actions;
    }

    private function productAllowsType(Article $product, string $type): bool
    {
        $sectionType = match ($type) {
            OrdreMission::TYPE_TECHNICIEN => ArticleSectionProduct::SECTION_TECHNICIEN,
            OrdreMission::TYPE_LABO => ArticleSectionProduct::SECTION_LABO,
            OrdreMission::TYPE_INGENIEUR => ArticleSectionProduct::SECTION_INGENIEUR,
            default => null,
        };

        $product->loadMissing('sectionProducts');

        return $product->sectionProducts->isEmpty()
            || ($sectionType !== null && $product->sectionProducts->contains('section_type', $sectionType));
    }

    private function syntheticAction(Article $article, string $type): ArticleAction
    {
        return new ArticleAction([
            'ref_article_id' => $article->id,
            'type' => $type,
            'libelle' => $article->libelle,
            'ordre' => 0,
        ]);
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
        if ($ligne->article?->isJalon()) {
            $ligne->article->loadMissing(['sectionProducts']);
            if ($ligne->article->sectionProducts->isNotEmpty()) {
                return false;
            }
            // Jalon legacy sans sections : repli planification terrain BC.
            return (bool) ($ligne->technicien_id && $ligne->date_debut_prevue);
        }

        if ($ligne->article?->isProduct()) {
            $ligne->article->loadMissing(['sectionProducts', 'productJalonLinks.jalon.sectionProducts']);
            if ($ligne->article->sectionProducts->isNotEmpty()) {
                return false;
            }
            foreach ($ligne->article->productJalonLinks as $link) {
                if ($link->jalon?->sectionProducts->contains('product_article_id', $ligne->article->id)) {
                    return false;
                }
            }
        }

        if ($ligne->technicien_id && $ligne->date_debut_prevue) {
            return true;
        }

        return trim((string) $ligne->libelle) !== '' && ! $ligne->ref_article_id;
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
