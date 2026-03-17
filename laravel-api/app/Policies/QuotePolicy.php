<?php

namespace App\Policies;

use App\Models\Quote;
use App\Models\User;

class QuotePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Quote $quote): bool
    {
        if ($user->isLab()) {
            return true;
        }
        return $quote->client_id === $user->client_id;
    }

    public function create(User $user): bool
    {
        return $user->isLab();
    }

    public function update(User $user, Quote $quote): bool
    {
        return $user->isLab();
    }

    public function delete(User $user, Quote $quote): bool
    {
        return $user->isLabAdmin();
    }
}
