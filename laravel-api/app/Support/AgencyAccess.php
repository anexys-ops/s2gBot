<?php

namespace App\Support;

use App\Models\Dossier;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Site;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Filtrage multi-agences : siège = {@see \App\Models\Client}, agences = {@see \App\Models\Agency}.
 * Si l'utilisateur n'a aucune ligne dans agency_user → accès à toutes les agences du client (comportement historique).
 */
final class AgencyAccess
{
    /**
     * @return list<int>|null null = pas de restriction par agence (toutes les agences du client)
     */
    public static function restrictedAgencyIds(User $user): ?array
    {
        if ($user->isLab() || ! $user->client_id) {
            return null;
        }
        $user->loadMissing('agencies');
        if ($user->agencies->isEmpty()) {
            return null;
        }

        return $user->agencies->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    public static function applyOrderScope(Builder $query, User $user): void
    {
        if ($user->isLab()) {
            return;
        }
        if (! $user->client_id) {
            $query->whereRaw('1 = 0');

            return;
        }
        $query->where('client_id', $user->client_id);
        if ($user->isSiteContact() && $user->site_id) {
            $query->where('site_id', $user->site_id);
        }
        $ids = self::restrictedAgencyIds($user);
        if ($ids !== null) {
            $query->whereIn('agency_id', $ids);
        }
    }

    public static function applySiteScope(Builder $query, User $user): void
    {
        if ($user->isLab()) {
            return;
        }
        if (! $user->client_id) {
            $query->whereRaw('1 = 0');

            return;
        }
        $query->where('client_id', $user->client_id);
        $ids = self::restrictedAgencyIds($user);
        if ($ids !== null) {
            $query->whereIn('agency_id', $ids);
        }
    }

    public static function applyInvoiceScope(Builder $query, User $user): void
    {
        if ($user->isLab()) {
            return;
        }
        if (! $user->client_id) {
            $query->whereRaw('1 = 0');

            return;
        }
        $query->where('client_id', $user->client_id);
        $ids = self::restrictedAgencyIds($user);
        if ($ids !== null) {
            $query->whereIn('agency_id', $ids);
        }
    }

    public static function applyQuoteScope(Builder $query, User $user): void
    {
        if ($user->isLab()) {
            return;
        }
        if (! $user->client_id) {
            $query->whereRaw('1 = 0');

            return;
        }
        $query->where('client_id', $user->client_id);
        $ids = self::restrictedAgencyIds($user);
        if ($ids !== null) {
            $query->whereIn('agency_id', $ids);
        }
    }

    public static function userMayAccessOrder(User $user, Order $order): bool
    {
        if ($user->isLab()) {
            return true;
        }
        if (! $user->client_id || (int) $order->client_id !== (int) $user->client_id) {
            return false;
        }
        if ($user->isSiteContact() && $user->site_id && (int) $order->site_id !== (int) $user->site_id) {
            return false;
        }
        $ids = self::restrictedAgencyIds($user);
        if ($ids === null) {
            return true;
        }
        if (! $order->agency_id) {
            return false;
        }

        return in_array((int) $order->agency_id, $ids, true);
    }

    public static function userMayAccessSite(User $user, Site $site): bool
    {
        if ($user->isLab()) {
            return true;
        }
        if (! $user->client_id || (int) $site->client_id !== (int) $user->client_id) {
            return false;
        }
        $ids = self::restrictedAgencyIds($user);
        if ($ids === null) {
            return true;
        }
        if (! $site->agency_id) {
            return false;
        }

        return in_array((int) $site->agency_id, $ids, true);
    }

    public static function userMayAccessInvoice(User $user, Invoice $invoice): bool
    {
        if ($user->isLab()) {
            return true;
        }
        if (! $user->client_id || (int) $invoice->client_id !== (int) $user->client_id) {
            return false;
        }
        $ids = self::restrictedAgencyIds($user);
        if ($ids === null) {
            return true;
        }
        if (! $invoice->agency_id) {
            return false;
        }

        return in_array((int) $invoice->agency_id, $ids, true);
    }

    public static function userMayAccessQuote(User $user, Quote $quote): bool
    {
        if ($user->isLab()) {
            return true;
        }
        if (! $user->client_id || (int) $quote->client_id !== (int) $user->client_id) {
            return false;
        }
        $ids = self::restrictedAgencyIds($user);
        if ($ids === null) {
            return true;
        }
        if (! $quote->agency_id) {
            return false;
        }

        return in_array((int) $quote->agency_id, $ids, true);
    }

    public static function applyDossierScope(Builder $query, User $user): void
    {
        if ($user->isLab()) {
            return;
        }
        if (! $user->client_id) {
            $query->whereRaw('1 = 0');

            return;
        }
        $query->where('dossiers.client_id', $user->client_id);
        if ($user->isSiteContact() && $user->site_id) {
            $query->where('dossiers.site_id', $user->site_id);
        }
        $ids = self::restrictedAgencyIds($user);
        if ($ids !== null) {
            $query->whereHas('site', function (Builder $q) use ($ids) {
                $q->whereIn('agency_id', $ids);
            });
        }
    }

    public static function userMayAccessDossier(User $user, Dossier $dossier): bool
    {
        if ($user->isLab()) {
            return true;
        }
        $dossier->loadMissing('site');
        if (! $user->client_id || (int) $dossier->client_id !== (int) $user->client_id) {
            return false;
        }
        if ($user->isSiteContact() && $user->site_id && (int) $dossier->site_id !== (int) $user->site_id) {
            return false;
        }
        $ids = self::restrictedAgencyIds($user);
        if ($ids === null) {
            return true;
        }
        if (! $dossier->site?->agency_id) {
            return false;
        }

        return in_array((int) $dossier->site->agency_id, $ids, true);
    }
}
