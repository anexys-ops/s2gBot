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
        if (($settings['enabled'] ?? true) === false) {
            return $this->fallbackRate($from, $to, $settings);
        }

        $cacheKey = sprintf('fx:%s:%s:%s', $from, $to, $date ?? 'latest');
        $ttlMinutes = max(5, (int) ($settings['cache_ttl_minutes'] ?? 360));

        return Cache::remember($cacheKey, now()->addMinutes($ttlMinutes), function () use ($from, $to, $date, $settings) {
            try {
                return $this->fetchFromProvider($from, $to, $date, $settings);
            } catch (\Throwable $e) {
                Log::warning('FX rate fetch failed, using fallback', [
                    'from' => $from,
                    'to' => $to,
                    'date' => $date,
                    'error' => $e->getMessage(),
                ]);

                return $this->fallbackRate($from, $to, $settings);
            }
        });
    }

    /**
     * @return array{enabled: bool, provider: string, base_currency: string, cache_ttl_minutes: int, fallback_rates: array<string, float>}
     */
    public function settings(): array
    {
        $stored = ModuleSetting::query()->where('module_key', 'fx_rates')->value('settings');
        $settings = is_array($stored) ? $stored : [];

        return array_merge([
            'enabled' => true,
            'provider' => 'frankfurter',
            'base_currency' => CurrencyCode::BASE,
            'cache_ttl_minutes' => 360,
            'fallback_rates' => [
                'EUR' => 10.85,
                'USD' => 10.02,
                'GBP' => 12.50,
                'CHF' => 11.40,
                'CAD' => 7.35,
                'SAR' => 2.67,
                'AED' => 2.73,
            ],
        ], $settings);
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
}
