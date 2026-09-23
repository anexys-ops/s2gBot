<?php

namespace App\Services;

use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\TestType;
use Illuminate\Database\Eloquent\Collection;

class TaskFormAssignmentService
{
    /** @return Collection<int, TestType> */
    public function typesFor(MissionTask $task): Collection
    {
        $line = $task->ordreMissionLigne;
        if (! $line?->ref_article_id) {
            return new Collection();
        }

        return TestType::query()
            ->whereHas('articles', function ($query) use ($line) {
                $query->where('ref_articles.id', $line->ref_article_id)
                    ->where(function ($query) use ($line) {
                        $query->whereNull('article_test_type.article_action_id');
                        if ($line->article_action_id) {
                            $query->orWhere('article_test_type.article_action_id', $line->article_action_id);
                        }
                    });
            })
            ->where(function ($query) use ($line) {
                $query->whereNull('context');
                $context = match ($line->ordreMission?->type) {
                    OrdreMission::TYPE_TECHNICIEN => 'terrain',
                    OrdreMission::TYPE_INGENIEUR => 'ingenieur',
                    OrdreMission::TYPE_LABO => 'labo',
                    default => null,
                };
                if ($context) {
                    $query->orWhere('context', $context);
                }
            })->get();
    }

    public function hasPendingForms(MissionTask $task): bool
    {
        $typeIds = $this->typesFor($task)->modelKeys();
        if ($typeIds === []) {
            return false;
        }

        return $task->testForms()->whereIn('test_type_id', $typeIds)
            ->where('status', 'validated')->count() !== count($typeIds);
    }
}
