<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('invoices:relaunch-overdue')->dailyAt('08:00');
Schedule::command('logs:archive --older-than=90')->weeklyOn(0, '3:00');
Schedule::command('logs:purge-archive --older-than-years=2')->monthlyOn(1, '3:30');
