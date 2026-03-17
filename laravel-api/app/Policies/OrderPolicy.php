<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class OrderPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Order $order): bool
    {
        if ($user->isLab()) {
            return true;
        }
        return $order->client_id === $user->client_id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Order $order): bool
    {
        if ($user->isLab()) {
            return true;
        }
        return $order->client_id === $user->client_id && $order->status === Order::STATUS_DRAFT;
    }

    public function delete(User $user, Order $order): bool
    {
        if ($user->isLabAdmin()) {
            return true;
        }
        return $order->client_id === $user->client_id && $order->status === Order::STATUS_DRAFT;
    }
}
