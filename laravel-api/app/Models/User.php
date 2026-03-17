<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_LAB_ADMIN = 'lab_admin';
    public const ROLE_LAB_TECHNICIAN = 'lab_technician';
    public const ROLE_CLIENT = 'client';
    public const ROLE_SITE_CONTACT = 'site_contact';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'client_id',
        'site_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function site()
    {
        return $this->belongsTo(Site::class);
    }

    public function isLabAdmin(): bool
    {
        return $this->role === self::ROLE_LAB_ADMIN;
    }

    public function isLabTechnician(): bool
    {
        return $this->role === self::ROLE_LAB_TECHNICIAN;
    }

    public function isLab(): bool
    {
        return in_array($this->role, [self::ROLE_LAB_ADMIN, self::ROLE_LAB_TECHNICIAN], true);
    }

    public function isClient(): bool
    {
        return $this->role === self::ROLE_CLIENT;
    }

    public function isSiteContact(): bool
    {
        return $this->role === self::ROLE_SITE_CONTACT;
    }
}
