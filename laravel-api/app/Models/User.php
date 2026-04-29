<?php

namespace App\Models;

use App\Support\PermissionCatalog;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
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

    /** v1.2.0 — rôles métier détaillés (RBAC LIMS géotechnique). */
    public const ROLE_COMMERCIAL = 'commercial';
    public const ROLE_INGENIEUR = 'ingenieur';
    public const ROLE_LABORANTIN = 'laborantin';
    public const ROLE_RESPONSABLE = 'responsable';

    public const ROLES_INTERNAL = [
        self::ROLE_LAB_ADMIN,
        self::ROLE_LAB_TECHNICIAN,
        self::ROLE_COMMERCIAL,
        self::ROLE_INGENIEUR,
        self::ROLE_LABORANTIN,
        self::ROLE_RESPONSABLE,
    ];

    protected $fillable = [
        'name',
        'email',
        'phone',
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

    public function dossiersCreees(): HasMany
    {
        return $this->hasMany(Dossier::class, 'created_by');
    }

    public function accessGroups(): BelongsToMany
    {
        return $this->belongsToMany(AccessGroup::class, 'access_group_user')->withTimestamps();
    }

    public function agencies(): BelongsToMany
    {
        return $this->belongsToMany(Agency::class, 'agency_user')->withTimestamps();
    }

    /**
     * Capacité métier (groupes). Les administrateurs laboratoire ont tout.
     */
    public function hasCapability(string $permission): bool
    {
        if ($this->isLabAdmin()) {
            return true;
        }

        $groups = $this->relationLoaded('accessGroups')
            ? $this->accessGroups
            : $this->accessGroups()->get();

        foreach ($groups as $group) {
            $perms = $group->permissions ?? [];
            if (! is_array($perms)) {
                continue;
            }
            if (in_array(PermissionCatalog::ALL_MARKER, $perms, true)) {
                return true;
            }
            if (in_array($permission, $perms, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Liste des clés de permission effectives (fusion groupes, sans doublons).
     *
     * @return list<string>
     */
    public function effectivePermissionKeys(): array
    {
        if ($this->isLabAdmin()) {
            return PermissionCatalog::keys();
        }

        $this->loadMissing('accessGroups');
        $out = [];
        foreach ($this->accessGroups as $group) {
            $perms = $group->permissions ?? [];
            if (! is_array($perms)) {
                continue;
            }
            if (in_array(PermissionCatalog::ALL_MARKER, $perms, true)) {
                return PermissionCatalog::keys();
            }
            foreach ($perms as $p) {
                if (is_string($p)) {
                    $out[$p] = true;
                }
            }
        }

        return array_keys($out);
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

    public function isCommercial(): bool
    {
        return $this->role === self::ROLE_COMMERCIAL;
    }

    public function isIngenieur(): bool
    {
        return $this->role === self::ROLE_INGENIEUR;
    }

    public function isLaborantin(): bool
    {
        return $this->role === self::ROLE_LABORANTIN;
    }

    public function isResponsable(): bool
    {
        return $this->role === self::ROLE_RESPONSABLE;
    }

    /** Peut valider un changement de statut (workflow). */
    public function canValidateStatus(): bool
    {
        return in_array($this->role, [self::ROLE_LAB_ADMIN, self::ROLE_RESPONSABLE], true);
    }

    /** Membre interne du laboratoire (terrain, labo, ingé, commercial, admin, responsable). */
    public function isInternal(): bool
    {
        return in_array($this->role, self::ROLES_INTERNAL, true);
    }
}
