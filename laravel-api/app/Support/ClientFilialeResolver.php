<?php

namespace App\Support;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Quote;
use App\Models\Site;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Résolution de l'agence filiale client BTP (trigramme dans les numéros de documents).
 */
final class ClientFilialeResolver
{
    public static function normalizeCode(?string $code): string
    {
        $normalized = strtoupper(trim((string) $code));

        return $normalized !== '' ? $normalized : 'HQ';
    }

    public static function headquartersId(int $clientId): ?int
    {
        $id = Agency::query()
            ->where('client_id', $clientId)
            ->where('is_headquarters', true)
            ->value('id');

        return $id !== null ? (int) $id : null;
    }

    public static function headquartersCode(int $clientId): string
    {
        $code = Agency::query()
            ->where('client_id', $clientId)
            ->where('is_headquarters', true)
            ->value('code');

        return self::normalizeCode(is_string($code) ? $code : null);
    }

    public static function codeForAgencyId(?int $agencyId, int $clientId): string
    {
        if (! $agencyId) {
            return self::headquartersCode($clientId);
        }

        $agency = Agency::query()->find($agencyId);
        if (! $agency || (int) $agency->client_id !== $clientId) {
            return self::headquartersCode($clientId);
        }

        return self::normalizeCode($agency->code);
    }

    /**
     * @throws ValidationException
     */
    public static function assertBelongsToClient(int $agencyId, int $clientId): void
    {
        $ok = Agency::query()
            ->whereKey($agencyId)
            ->where('client_id', $clientId)
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages([
                'filiale_agency_id' => 'Agence filiale invalide pour ce client.',
            ]);
        }
    }

    /**
     * @throws ValidationException
     */
    public static function resolveAgencyId(
        User $user,
        int $clientId,
        ?int $siteId = null,
        ?int $requestedAgencyId = null,
    ): int {
        if ($requestedAgencyId !== null) {
            self::assertBelongsToClient($requestedAgencyId, $clientId);

            return $requestedAgencyId;
        }

        if ($siteId !== null) {
            $site = Site::query()->find($siteId);
            if ($site && (int) $site->client_id === $clientId && $site->agency_id) {
                self::assertBelongsToClient((int) $site->agency_id, $clientId);

                return (int) $site->agency_id;
            }
        }

        if ($user->isClient() || $user->isSiteContact()) {
            $user->loadMissing('agencies');
            if ($user->agencies->count() === 1) {
                return (int) $user->agencies->first()->id;
            }
            if ($user->agencies->count() > 1) {
                throw ValidationException::withMessages([
                    'filiale_agency_id' => 'Sélectionnez une agence filiale.',
                ]);
            }
        }

        $hqId = self::headquartersId($clientId);
        if ($hqId !== null) {
            return $hqId;
        }

        throw ValidationException::withMessages([
            'filiale_agency_id' => 'Aucune agence filiale configurée pour ce client.',
        ]);
    }

    /**
     * @throws ValidationException
     */
    public static function resolveAgencyCode(
        User $user,
        int $clientId,
        ?int $siteId = null,
        ?int $requestedAgencyId = null,
    ): string {
        $agencyId = self::resolveAgencyId($user, $clientId, $siteId, $requestedAgencyId);

        return self::codeForAgencyId($agencyId, $clientId);
    }

    public static function filialeAgencyIdFromQuote(Quote $quote): ?int
    {
        $meta = $quote->meta;
        if (is_array($meta) && ! empty($meta['filiale_agency_id'])) {
            return (int) $meta['filiale_agency_id'];
        }

        $quote->loadMissing('site');
        if ($quote->site?->agency_id) {
            return (int) $quote->site->agency_id;
        }

        if ($quote->agency_id) {
            $agency = Agency::query()->find($quote->agency_id);
            if ($agency && $agency->client_id !== null) {
                return (int) $agency->id;
            }
        }

        return self::headquartersId((int) $quote->client_id);
    }

    public static function codeForQuote(Quote $quote): string
    {
        return self::codeForAgencyId(self::filialeAgencyIdFromQuote($quote), (int) $quote->client_id);
    }

    public static function codeForSite(?Site $site): string
    {
        if (! $site) {
            return 'HQ';
        }

        return self::codeForAgencyId(
            $site->agency_id ? (int) $site->agency_id : null,
            (int) $site->client_id,
        );
    }

    public static function codeForInvoice(Invoice $invoice): string
    {
        if ($invoice->agency_id) {
            $agency = Agency::query()->find($invoice->agency_id);
            if ($agency && $agency->client_id !== null) {
                return self::normalizeCode($agency->code);
            }
        }

        return self::headquartersCode((int) $invoice->client_id);
    }

    /**
     * @return array<string, mixed>
     */
    public static function mergeFilialeMeta(?array $meta, int $filialeAgencyId): array
    {
        $meta = is_array($meta) ? $meta : [];

        $meta['filiale_agency_id'] = $filialeAgencyId;

        return $meta;
    }
}
