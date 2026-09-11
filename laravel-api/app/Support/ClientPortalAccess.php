<?php

namespace App\Support;

use App\Models\Client;
use App\Models\LabReport;
use App\Models\OrdreMission;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

final class ClientPortalAccess
{
    public static function isPortalUser(User $user): bool
    {
        return $user->isClient() || $user->isSiteContact();
    }

    /**
     * @return list<string>
     */
    public static function effectiveModules(User $user): array
    {
        if (! self::isPortalUser($user)) {
            return [];
        }

        $client = $user->relationLoaded('client') ? $user->client : $user->client()->first();

        return ClientPortalCatalog::normalize($client?->portal_modules);
    }

    public static function hasModule(User $user, string $module): bool
    {
        return in_array($module, self::effectiveModules($user), true);
    }

    public static function assertModule(User $user, string $module): void
    {
        if (! self::hasModule($user, $module)) {
            throw new AccessDeniedHttpException('Module portail non autorisé.');
        }
    }

    /**
     * @param  Builder<OrdreMission>  $query
     */
    public static function applyOrdreMissionScope(Builder $query, User $user): void
    {
        if (! self::isPortalUser($user)) {
            return;
        }

        self::assertModule($user, ClientPortalCatalog::INTERVENTIONS);

        if (! $user->client_id) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where('client_id', $user->client_id);

        if ($user->isSiteContact() && $user->site_id) {
            $query->where('site_id', $user->site_id);
        }

        $query->whereIn('statut', [
            OrdreMission::STATUT_PLANIFIE,
            OrdreMission::STATUT_EN_COURS,
        ]);
    }

    public static function userMayAccessOrdreMission(User $user, OrdreMission $om): bool
    {
        if (! self::isPortalUser($user)) {
            return true;
        }

        if (! self::hasModule($user, ClientPortalCatalog::INTERVENTIONS)) {
            return false;
        }

        if ((int) $om->client_id !== (int) $user->client_id) {
            return false;
        }

        if ($user->isSiteContact() && $user->site_id && (int) $om->site_id !== (int) $user->site_id) {
            return false;
        }

        return in_array($om->statut, [
            OrdreMission::STATUT_PLANIFIE,
            OrdreMission::STATUT_EN_COURS,
        ], true);
    }

    /**
     * @param  Builder<LabReport>  $query
     */
    public static function applyLabReportScope(Builder $query, User $user): void
    {
        if (! self::isPortalUser($user)) {
            return;
        }

        self::assertModule($user, ClientPortalCatalog::RAPPORTS);

        if (! $user->client_id) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where('client_id', $user->client_id);

        if ($user->isSiteContact() && $user->site_id) {
            $query->where('site_id', $user->site_id);
        }

        $query->whereIn('status', ['signe', 'emis']);
    }

    public static function userMayAccessLabReport(User $user, LabReport $report): bool
    {
        if (! self::isPortalUser($user)) {
            return true;
        }

        if (! self::hasModule($user, ClientPortalCatalog::RAPPORTS)) {
            return false;
        }

        if ((int) $report->client_id !== (int) $user->client_id) {
            return false;
        }

        if ($user->isSiteContact() && $user->site_id && (int) $report->site_id !== (int) $user->site_id) {
            return false;
        }

        return in_array($report->status, ['signe', 'emis'], true);
    }

    /**
     * @return array<string, mixed>
     */
    public static function authPayload(User $user): array
    {
        return [
            'effective_portal_modules' => self::effectiveModules($user),
            'is_portal_user' => self::isPortalUser($user),
        ];
    }

    /**
     * @param  list<string>  $modules
     */
    public static function syncClientModules(Client $client, array $modules): Client
    {
        $client->portal_modules = ClientPortalCatalog::normalize($modules);
        $client->save();

        return $client->fresh();
    }
}
