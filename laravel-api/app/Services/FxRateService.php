<?php

namespace App\Services;

use App\Models\ModuleSetting;
use App\Support\CurrencyCode;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FxRateService
{
    /**
     * Taux : 1 unité de $from vaut X unités de $to.
     */
    public function getRate(string $from, string $to, ?string $date = null): float
    {
        $from = CurrencyCode::normalize($from);
        $to = CurrencyCode::normalize($to);

        if ($from === $to) {
            return 1.0;
        }

        $settings = $this->settings();
        $cacheKey = $this->rateCacheKey($from, $to, $date);
        $ttlMinutes = max(5, (int) ($settings['cache_ttl_minutes'] ?? 360));

        if (($settings['enabled'] ?? true) === false) {
            return Cache::remember($cacheKey, now()->addMinutes($ttlMinutes), function () use ($from, $to, $date, $settings) {
                $rate = $this->fallbackRate($from, $to, $settings);
                $this->storeMeta($from, $to, $date, 'fallback', $rate);

                return $rate;
            });
        }

        return Cache::remember($cacheKey, now()->addMinutes($ttlMinutes), function () use ($from, $to, $date, $settings) {
            try {
                $rate = $this->fetchFromProvider($from, $to, $date, $settings);
                $this->storeMeta($from, $to, $date, 'api', $rate);

                return $rate;
            } catch (\Throwable $e) {
                Log::warning('FX rate fetch failed, using fallback', [
                    'from' => $from,
                    'to' => $to,
                    'date' => $date,
                    'error' => $e->getMessage(),
                ]);

                $rate = $this->fallbackRate($from, $to, $settings);
                $this->storeMeta($from, $to, $date, 'fallback', $rate);

                return $rate;
            }
        });
    }

    /**
     * @return array{
     *   enabled: bool,
     *   provider: string,
     *   base_currency: string,
     *   cache_ttl_minutes: int,
     *   fallback_rates: array<string, float>,
     *   extra_currencies: list<array{code?: string, label?: string, name?: string}>,
     *   last_refresh_at: string|null,
     *   rates: list<array{
     *     code: string,
     *     label: string,
     *     name: string,
     *     rate: float|null,
     *     fetched_at: string|null,
     *     source: string|null
     *   }>
     * }
     */
    public function status(): array
    {
        $settings = $this->settings();
        $rows = [];

        foreach (CurrencyCode::foreignCodes() as $code) {
            $meta = Cache::get($this->metaCacheKey($code, CurrencyCode::BASE, null));
            $cachedRate = Cache::get($this->rateCacheKey($code, CurrencyCode::BASE, null));
            $rows[] = [
                'code' => $code,
                'label' => CurrencyCode::displayLabel($code),
                'name' => CurrencyCode::displayName($code),
                'rate' => is_numeric($cachedRate) ? round((float) $cachedRate, 6) : null,
                'fetched_at' => is_array($meta) ? ($meta['fetched_at'] ?? null) : null,
                'source' => is_array($meta) ? ($meta['source'] ?? null) : null,
            ];
        }

        return [
            'enabled' => (bool) ($settings['enabled'] ?? true),
            'provider' => (string) ($settings['provider'] ?? 'frankfurter'),
            'base_currency' => CurrencyCode::BASE,
            'cache_ttl_minutes' => max(5, (int) ($settings['cache_ttl_minutes'] ?? 360)),
            'fallback_rates' => is_array($settings['fallback_rates'] ?? null) ? $settings['fallback_rates'] : [],
            'extra_currencies' => is_array($settings['extra_currencies'] ?? null) ? $settings['extra_currencies'] : [],
            'last_refresh_at' => Cache::get('fx:last_refresh_at'),
            'rates' => $rows,
        ];
    }

    /**
     * Vide le cache et relance la récupération des taux vers MAD.
     *
     * @return array<string, mixed>
     */
    public function refresh(): array
    {
        foreach (CurrencyCode::foreignCodes() as $code) {
            Cache::forget($this->rateCacheKey($code, CurrencyCode::BASE, null));
            Cache::forget($this->metaCacheKey($code, CurrencyCode::BASE, null));
        }

        Cache::put('fx:last_refresh_at', now()->toIso8601String(), now()->addDays(30));

        foreach (CurrencyCode::foreignCodes() as $code) {
            $this->getRate($code, CurrencyCode::BASE, null);
        }

        return $this->status();
    }

    /**
     * @return array{enabled: bool, provider: string, base_currency: string, cache_ttl_minutes: int, fallback_rates: array<string, float>, extra_currencies: list<array<string, string>>}
     */
    public function settings(): array
    {
        $stored = ModuleSetting::query()->where('module_key', 'fx_rates')->value('settings');
        $settings = is_array($stored) ? $stored : [];

        $defaults = [
            'enabled' => true,
            'provider' => 'frankfurter',
            'base_currency' => CurrencyCode::BASE,
            'cache_ttl_minutes' => 360,
            'extra_currencies' => [],
            'fallback_rates' => [
                'EUR' => 10.85,
                'USD' => 10.02,
                'GBP' => 12.50,
                'CHF' => 11.40,
                'CAD' => 7.35,
                'SAR' => 2.67,
                'AED' => 2.73,
                'XOF' => 0.0165,
                'XAF' => 0.0165,
            ],
        ];

        $merged = array_merge($defaults, $settings);
        if (is_array($settings['fallback_rates'] ?? null)) {
            $merged['fallback_rates'] = array_merge($defaults['fallback_rates'], $settings['fallback_rates']);
        }
        if (is_array($settings['extra_currencies'] ?? null)) {
            $merged['extra_currencies'] = $settings['extra_currencies'];
        }

        return $merged;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function fetchFromProvider(string $from, string $to, ?string $date, array $settings): float
    {
        $provider = (string) ($settings['provider'] ?? 'frankfurter');

        return match ($provider) {
            'frankfurter' => $this->fetchFrankfurter($from, $to, $date),
            default => throw new \InvalidArgumentException("Fournisseur FX inconnu : {$provider}"),
        };
    }

    private function fetchFrankfurter(string $from, string $to, ?string $date): float
    {
        $endpoint = $date && $date !== now()->toDateString()
            ? "https://api.frankfurter.app/{$date}"
            : 'https://api.frankfurter.app/latest';

        $response = Http::timeout(8)->get($endpoint, [
            'from' => $from,
            'to' => $to,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Réponse FX invalide ('.$response->status().').');
        }

        $rate = $response->json("rates.{$to}");
        if (! is_numeric($rate) || (float) $rate <= 0) {
            throw new \RuntimeException("Taux FX introuvable pour {$from}→{$to}.");
        }

        return round((float) $rate, 6);
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function fallbackRate(string $from, string $to, array $settings): float
    {
        $rates = is_array($settings['fallback_rates'] ?? null) ? $settings['fallback_rates'] : [];

        if ($from === CurrencyCode::BASE) {
            $foreignRate = (float) ($rates[$to] ?? 0);
            if ($foreignRate > 0) {
                return round(1 / $foreignRate, 6);
            }
        }

        if ($to === CurrencyCode::BASE) {
            $foreignRate = (float) ($rates[$from] ?? 0);
            if ($foreignRate > 0) {
                return round($foreignRate, 6);
            }
        }

        $fromToMad = $from === CurrencyCode::BASE ? 1.0 : (float) ($rates[$from] ?? 0);
        $toToMad = $to === CurrencyCode::BASE ? 1.0 : (float) ($rates[$to] ?? 0);

        if ($fromToMad > 0 && $toToMad > 0) {
            return round($fromToMad / $toToMad, 6);
        }

        throw new \RuntimeException("Aucun taux de repli disponible pour {$from}→{$to}.");
    }

    private function rateCacheKey(string $from, string $to, ?string $date): string
    {
        return sprintf('fx:%s:%s:%s', $from, $to, $date ?? 'latest');
    }

    private function metaCacheKey(string $from, string $to, ?string $date): string
    {
        return sprintf('fx:meta:%s:%s:%s', $from, $to, $date ?? 'latest');
    }

    private function storeMeta(string $from, string $to, ?string $date, string $source, float $rate): void
    {
        Cache::put($this->metaCacheKey($from, $to, $date), [
            'fetched_at' => now()->toIso8601String(),
            'source' => $source,
            'rate' => $rate,
        ], now()->addDays(7));
    }
}
