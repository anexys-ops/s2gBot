<?php

namespace App\Policies;

use App\Models\Report;
use App\Models\User;

class ReportPolicy
{
    public function view(User $user, Report $report): bool
    {
        $order = $report->order;
        if ($user->isLab()) {
            return true;
        }
        return $order->client_id === $user->client_id;
    }
}
