<?php

namespace App\Policies;

use App\Models\Catalogue\Article;
use App\Models\User;

class ArticlePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Article $article): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isLabAdmin();
    }

    public function update(User $user, Article $article): bool
    {
        return $user->isLabAdmin();
    }

    public function delete(User $user, Article $article): bool
    {
        return $user->isLabAdmin();
    }
}
