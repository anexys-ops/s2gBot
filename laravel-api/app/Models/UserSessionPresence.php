<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSessionPresence extends Model
{
    public $timestamps = false;

    protected $table = 'user_session_presence';

    protected $fillable = [
        'token_id',
        'user_id',
        'ip_address',
        'user_agent',
        'current_page',
        'last_seen_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
