<?php

namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(\App\Models\Order::class, \App\Policies\OrderPolicy::class);
        Gate::policy(\App\Models\Invoice::class, \App\Policies\InvoicePolicy::class);
        Gate::policy(\App\Models\Report::class, \App\Policies\ReportPolicy::class);
        Gate::policy(\App\Models\Quote::class, \App\Policies\QuotePolicy::class);
    }
}
