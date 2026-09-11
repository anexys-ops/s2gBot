<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Quote;
use App\Support\CurrencyCode;

class DocumentCurrencyService
{
    public function __construct(private readonly FxRateService $fxRates) {}

    public function currencyForClient(?Client $client): string
    {
        return CurrencyCode::normalize($client?->currency_code);
    }

    /**
     * @return array{currency_code: string, exchange_rate: float, exchange_rate_date: string}
     */
    public function snapshotForClient(Client $client, ?string $documentDate = null): array
    {
        $currency = $this->currencyForClient($client);
        $date = $documentDate ?? now()->toDateString();

        if ($currency === CurrencyCode::BASE) {
            return [
                'currency_code' => CurrencyCode::BASE,
                'exchange_rate' => 1.0,
                'exchange_rate_date' => $date,
            ];
        }

        return [
            'currency_code' => $currency,
            'exchange_rate' => $this->fxRates->getRate($currency, CurrencyCode::BASE, $date),
            'exchange_rate_date' => $date,
        ];
    }

    /**
     * @return array{amount_ht_base: float, amount_ttc_base: float}
     */
    public function baseAmounts(float $amountHt, float $amountTtc, float $exchangeRate): array
    {
        $rate = max(0.0, $exchangeRate);

        return [
            'amount_ht_base' => round($amountHt * $rate, 2),
            'amount_ttc_base' => round($amountTtc * $rate, 2),
        ];
    }

    public function applyQuoteCurrencyOnCreate(Quote $quote, Client $client): void
    {
        $snapshot = $this->snapshotForClient($client, $quote->quote_date?->toDateString());
        $quote->forceFill($snapshot)->save();
    }

    public function syncQuoteTotals(Quote $quote, float $amountHt, float $amountTtc, bool $refreshRate): void
    {
        $quote->loadMissing('client');
        $client = $quote->client;
        if (! $client) {
            return;
        }

        $currency = $this->currencyForClient($client);
        $date = $quote->quote_date?->toDateString() ?? now()->toDateString();
        $exchangeRate = (float) ($quote->exchange_rate ?? 1);

        if ($quote->currency_code !== $currency || $quote->currency_code === null) {
            $quote->currency_code = $currency;
        }

        if ($refreshRate || $exchangeRate <= 0 || $quote->exchange_rate === null) {
            $snapshot = $this->snapshotForClient($client, $date);
            $quote->currency_code = $snapshot['currency_code'];
            $quote->exchange_rate = $snapshot['exchange_rate'];
            $quote->exchange_rate_date = $snapshot['exchange_rate_date'];
            $exchangeRate = $snapshot['exchange_rate'];
        }

        $base = $this->baseAmounts($amountHt, $amountTtc, $exchangeRate);
        $quote->update(array_merge([
            'amount_ht' => $amountHt,
            'amount_ttc' => $amountTtc,
        ], $base));
    }

    public function applyInvoiceCurrencyOnCreate(Invoice $invoice, Client $client, ?string $sourceCurrency = null): void
    {
        $currency = $sourceCurrency
            ? CurrencyCode::normalize($sourceCurrency)
            : $this->currencyForClient($client);

        $date = $invoice->invoice_date?->toDateString() ?? now()->toDateString();
        $snapshot = $currency === CurrencyCode::BASE
            ? ['currency_code' => CurrencyCode::BASE, 'exchange_rate' => 1.0, 'exchange_rate_date' => $date]
            : [
                'currency_code' => $currency,
                'exchange_rate' => $this->fxRates->getRate($currency, CurrencyCode::BASE, $date),
                'exchange_rate_date' => $date,
            ];

        $invoice->forceFill($snapshot)->save();
    }

    public function syncInvoiceTotals(Invoice $invoice, float $amountHt, float $amountTtc, bool $refreshRate): void
    {
        $invoice->loadMissing('client');
        $client = $invoice->client;
        if (! $client) {
            return;
        }

        $date = $invoice->invoice_date?->toDateString() ?? now()->toDateString();
        $currency = CurrencyCode::normalize($invoice->currency_code ?: $this->currencyForClient($client));
        $exchangeRate = (float) ($invoice->exchange_rate ?? 1);

        if ($refreshRate || $exchangeRate <= 0 || $invoice->exchange_rate === null) {
            $snapshot = $currency === CurrencyCode::BASE
                ? ['currency_code' => CurrencyCode::BASE, 'exchange_rate' => 1.0, 'exchange_rate_date' => $date]
                : [
                    'currency_code' => $currency,
                    'exchange_rate' => $this->fxRates->getRate($currency, CurrencyCode::BASE, $date),
                    'exchange_rate_date' => $date,
                ];
            $currency = $snapshot['currency_code'];
            $exchangeRate = $snapshot['exchange_rate'];
            $invoice->exchange_rate = $exchangeRate;
            $invoice->exchange_rate_date = $snapshot['exchange_rate_date'];
        }

        $base = $this->baseAmounts($amountHt, $amountTtc, $exchangeRate);
        $invoice->update(array_merge([
            'currency_code' => $currency,
            'amount_ht' => $amountHt,
            'amount_ttc' => $amountTtc,
        ], $base));
    }

    public function convertFromBase(float $amountMad, string $targetCurrency, ?string $date = null): float
    {
        $targetCurrency = CurrencyCode::normalize($targetCurrency);
        if ($targetCurrency === CurrencyCode::BASE) {
            return round($amountMad, 2);
        }

        $rate = $this->fxRates->getRate($targetCurrency, CurrencyCode::BASE, $date);

        return round($amountMad / $rate, 2);
    }
}
