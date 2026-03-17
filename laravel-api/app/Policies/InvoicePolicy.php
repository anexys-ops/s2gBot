<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Invoice $invoice): bool
    {
        if ($user->isLab()) {
            return true;
        }
        return $invoice->client_id === $user->client_id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->isLabAdmin();
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->isLabAdmin();
    }
}
