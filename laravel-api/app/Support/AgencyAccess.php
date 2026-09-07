<?php

namespace App\Support;

use App\Models\Agency;
use App\Models\BonCommande;
use App\Models\BonLivraison;
use App\Models\Catalogue\Article;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Site;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Filtrage multi-agences labo S2G + portail client.
 *
 * Staff labo :
 * - Siège (lab_admin ou agency_id null) → vision globale
 * - Agence (agency_id renseigné) → périmètre agence + clients configurés
 *
 * Portail client :
 * - pivot agency_user ; vide = toutes les agences du client
 */
final class AgencyAccess
{
    /** Siège labo : accès global (stats, devis, clients non restreints). */
    public static function isLabSiege(User $user): bool
    {
        if ($user->isLabAdmin()) {
            return true;
        }
        if ($user->isInternal() && $user->agency_id === null) {
            return true;
        }

        return false;
    }

    /** Agence labo de rattachement (null = siège). */
    public static function labAgencyId(User $user): ?int
    {
        if (! $user->isInternal() || self::isLabSiege($user)) {
            return null;
        }

        return $user->agency_id ? (int) $user->agency_id : null;
    }

    /**
     * @return list<int>|null null = pas de restriction (portail client, toutes agences)
     */
    public static function restrictedAgencyIds(User $user): ?array
    {
        if ($user->isInternal()) {
            $labId = self::labAgencyId($user);

            return $labId !== null ? [$labId] : null;
        }
        if (! $user->client_id) {
            return null;
        }
        $user->loadMissing('agencies');
        if ($user->agencies->isEmpty()) {
            return null;
        }

        return $user->agencies->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    public static function applyClientScope(Builder $query, User $user): void
    {
        if ($user->isClient() || $user->isSiteContact()) {
            if ($user->client_id) {
                $query->where('clients.id', $user->client_id);
            } else {
                $query->whereRaw('1 = 0');
            }

            return;
        }

        $labId = self::labAgencyId($user);
        if ($labId === null) {
            return;
        }

        $query->where(function (Builder $q) use ($labId) {
            $q->whereDoesntHave('visibleLabAgencies')
                ->orWhereHas('visibleLabAgencies', fn (Builder $aq) => $aq->where('agencies.id', $labId));
        });
    }

    public static function userMayAccessClient(User $user, Client $client): bool
    {
        if ($user->isClient() || $user->isSiteContact()) {
            return (int) $user->client_id === (int) $client->id;
        }

        $labId = self::labAgencyId($user);
        if ($labId === null) {
            return true;
        }

        $client->loadCount('visibleLabAgencies');
        if ($client->visible_lab_agencies_count === 0) {
            return true;
        }

        return $client->visibleLabAgencies()->where('agencies.id', $labId)->exists();
    }

    public static function applyArticleScope(Builder $query, User $user): void
    {
        if (! $user->isInternal() || self::isLabSiege($user)) {
            return;
        }

        $labId = self::labAgencyId($user);
        if ($labId === null) {
            return;
        }

        $table = $query->getModel()->getTable();
        $query->where(function (Builder $q) use ($labId, $table) {
            $q->where("{$table}.is_multi_site", true)
                ->orWhereHas('visibleLabAgencies', fn (Builder $aq) => $aq->where('agencies.id', $labId));
        });
    }

    private static function applyLabDocumentAgencyScope(Builder $query, User $user, string $column = 'agency_id'): void
    {
        if ($user->isClient() || $user->isSiteContact()) {
            return;
        }

        $ids = self::restrictedAgencyIds($user);
        if ($ids !== null) {
            $query->whereIn($column, $ids);
        }
    }

    public static function applyOrderScope(Builder $query, User $user): void
    {
        if ($user->isInternal()) {
            self::applyLabDocumentAgencyScope($query, $user);

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
        if ($user->isInternal()) {
            self::applyLabDocumentAgencyScope($query, $user);

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
        if ($user->isInternal()) {
            self::applyLabDocumentAgencyScope($query, $user);

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
        if ($user->isInternal()) {
            self::applyLabDocumentAgencyScope($query, $user);

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

    private static function internalUserMayAccessDocumentAgency(User $user, ?int $documentAgencyId): bool
    {
        if (! $user->isInternal()) {
            return true;
        }
        if (self::isLabSiege($user)) {
            return true;
        }
        $labId = self::labAgencyId($user);
        if ($labId === null) {
            return true;
        }
        if (! $documentAgencyId) {
            return false;
        }

        return (int) $documentAgencyId === $labId;
    }

    public static function userMayAccessOrder(User $user, Order $order): bool
    {
        if ($user->isInternal()) {
            if (! self::internalUserMayAccessDocumentAgency($user, $order->agency_id ? (int) $order->agency_id : null)) {
                return false;
            }
            if ($order->client_id) {
                $client = Client::query()->find($order->client_id);
                if ($client && ! self::userMayAccessClient($user, $client)) {
                    return false;
                }
            }

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
        if ($user->isInternal()) {
            if (! self::internalUserMayAccessDocumentAgency($user, $site->agency_id ? (int) $site->agency_id : null)) {
                return false;
            }
            if ($site->client_id) {
                $client = $site->relationLoaded('client') ? $site->client : Client::query()->find($site->client_id);

                return $client ? self::userMayAccessClient($user, $client) : true;
            }

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
        if ($user->isInternal()) {
            if (! self::internalUserMayAccessDocumentAgency($user, $invoice->agency_id ? (int) $invoice->agency_id : null)) {
                return false;
            }
            if ($invoice->client_id) {
                $client = Client::query()->find($invoice->client_id);
                if ($client && ! self::userMayAccessClient($user, $client)) {
                    return false;
                }
            }

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
        if ($user->isInternal()) {
            if (! self::internalUserMayAccessDocumentAgency($user, $quote->agency_id ? (int) $quote->agency_id : null)) {
                return false;
            }
            if ($quote->client_id) {
                $client = Client::query()->find($quote->client_id);
                if ($client && ! self::userMayAccessClient($user, $client)) {
                    return false;
                }
            }

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
        if ($user->isInternal()) {
            $labId = self::labAgencyId($user);
            if ($labId !== null) {
                $query->whereHas('site', fn (Builder $q) => $q->where('agency_id', $labId));
            }

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

    public static function userMayAccessBonCommande(User $user, BonCommande $bc): bool
    {
        if ($user->isInternal() && ! self::isLabSiege($user)) {
            $bc->loadMissing('dossier.site');
            if (! self::internalUserMayAccessDocumentAgency($user, $bc->dossier?->site?->agency_id ? (int) $bc->dossier->site->agency_id : null)) {
                return false;
            }
        }
        if ($user->isLab() && self::isLabSiege($user)) {
            return true;
        }
        if ($user->isInternal()) {
            if ($bc->client_id) {
                $client = Client::query()->find($bc->client_id);

                return $client ? self::userMayAccessClient($user, $client) : true;
            }

            return true;
        }
        if (! $user->client_id || (int) $bc->client_id !== (int) $user->client_id) {
            return false;
        }
        $ids = self::restrictedAgencyIds($user);
        if ($ids === null) {
            return true;
        }
        $bc->loadMissing('dossier.site');
        if (! $bc->dossier?->site?->agency_id) {
            return false;
        }

        return in_array((int) $bc->dossier->site->agency_id, $ids, true);
    }

    public static function userMayAccessBonLivraison(User $user, BonLivraison $bl): bool
    {
        if ($user->isInternal() && ! self::isLabSiege($user)) {
            $bl->loadMissing('dossier.site');
            if (! self::internalUserMayAccessDocumentAgency($user, $bl->dossier?->site?->agency_id ? (int) $bl->dossier->site->agency_id : null)) {
                return false;
            }
        }
        if ($user->isLab() && self::isLabSiege($user)) {
            return true;
        }
        if ($user->isInternal()) {
            if ($bl->client_id) {
                $client = Client::query()->find($bl->client_id);

                return $client ? self::userMayAccessClient($user, $client) : true;
            }

            return true;
        }
        if (! $user->client_id || (int) $bl->client_id !== (int) $user->client_id) {
            return false;
        }
        $ids = self::restrictedAgencyIds($user);
        if ($ids === null) {
            return true;
        }
        $bl->loadMissing('dossier.site');
        if (! $bl->dossier?->site?->agency_id) {
            return false;
        }

        return in_array((int) $bl->dossier->site->agency_id, $ids, true);
    }

    public static function userMayAccessDossier(User $user, Dossier $dossier): bool
    {
        if ($user->isInternal()) {
            $dossier->loadMissing('site');
            if (! self::internalUserMayAccessDocumentAgency($user, $dossier->site?->agency_id ? (int) $dossier->site->agency_id : null)) {
                return false;
            }
            if ($dossier->client_id) {
                $client = Client::query()->find($dossier->client_id);
                if ($client && ! self::userMayAccessClient($user, $client)) {
                    return false;
                }
            }

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

    public static function userMayAccessArticle(User $user, Article $article): bool
    {
        if (! $user->isInternal() || self::isLabSiege($user)) {
            return true;
        }

        $labId = self::labAgencyId($user);
        if ($labId === null) {
            return true;
        }

        if ($article->is_multi_site) {
            return true;
        }

        return $article->visibleLabAgencies()->where('agencies.id', $labId)->exists();
    }

    /**
     * Agences labo actives (client_id null) pour la configuration.
     *
     * @return list<int>
     */
    public static function labAgencyIdsForConfig(): array
    {
        return Agency::query()
            ->whereNull('client_id')
            ->where('active', true)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }
}
