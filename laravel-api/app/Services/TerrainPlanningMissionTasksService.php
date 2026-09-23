<?php

namespace App\Services;

use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\User;
use App\Support\AgencyAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class TerrainPlanningMissionTasksService
{
    /** @return Collection<int, MissionTask> */
    public function scheduled(string $from, string $to, ?int $userId = null, ?User $viewer = null, string $type = OrdreMission::TYPE_TECHNICIEN): Collection
    {
        $query = $this->baseQuery($userId, $viewer, $type)
            ->whereNotNull('assigned_user_id')
            ->whereDate('planned_date', '<=', $to)
            ->where(function (Builder $q) use ($from) {
                $q->whereDate('due_date', '>=', $from)
                    ->orWhere(function (Builder $withoutDueDate) use ($from) {
                        $withoutDueDate->whereNull('due_date')->whereDate('planned_date', '>=', $from);
                    });
            });

        return $query->orderBy('planned_date')->orderBy('id')->get();
    }

    /** @return Collection<int, MissionTask> */
    public function undated(?int $userId = null, ?User $viewer = null, string $type = OrdreMission::TYPE_TECHNICIEN): Collection
    {
        $query = $this->baseQuery($userId, $viewer, $type);
        if ($type === OrdreMission::TYPE_TECHNICIEN) {
            $query->whereNotNull('assigned_user_id')->whereNull('planned_date');
        } else {
            $query->where(function (Builder $q) {
                $q->whereNull('planned_date')->orWhereNull('assigned_user_id');
            });
        }

        return $query
            ->orderBy('id')
            ->get();
    }

    private function baseQuery(?int $userId, ?User $viewer, string $type): Builder
    {
        $query = MissionTask::query()
            ->with([
                'assignedUser:id,name,email,role',
                'ordreMissionLigne.bonCommandeLigne',
                'ordreMissionLigne.ordreMission.bonCommande.client',
                'ordreMissionLigne.ordreMission.client',
                'ordreMissionLigne.ordreMission.dossier',
                'ordreMissionLigne.ordreMission.site',
            ])
            ->where('statut', '!=', MissionTask::STATUT_REJECTED)
            ->whereHas('ordreMissionLigne.ordreMission', fn (Builder $q) => $q
                ->where('type', $type)
                ->where('statut', '!=', OrdreMission::STATUT_ANNULE));

        if ($userId !== null) {
            $query->where('assigned_user_id', $userId);
        }
        if ($viewer && ! $viewer->isLab()) {
            $query->whereHas('ordreMissionLigne.ordreMission.dossier', function (Builder $q) use ($viewer) {
                AgencyAccess::applyDossierScope($q, $viewer);
            });
        }

        return $query;
    }
}
