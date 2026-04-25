<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExtrafieldDefinition extends Model
{
    public const ENTITY_CLIENT = 'client';

    public const ENTITY_SITE = 'site';

    public const ENTITY_ORDER = 'order';

    public const ENTITY_INVOICE = 'invoice';

    public const ENTITY_QUOTE = 'quote';

    public const ENTITY_ARTICLE = 'article';

    public const ENTITY_DOSSIER = 'dossier';

    public const ENTITY_BON_COMMANDE = 'bon_commande';

    public const ENTITY_BON_LIVRAISON = 'bon_livraison';

    public const ENTITY_MISSION = 'mission';

    public const ENTITY_EQUIPMENT = 'equipment';

    public static function entityTypes(): array
    {
        return [
            self::ENTITY_CLIENT,
            self::ENTITY_SITE,
            self::ENTITY_ORDER,
            self::ENTITY_INVOICE,
            self::ENTITY_QUOTE,
            self::ENTITY_ARTICLE,
            self::ENTITY_DOSSIER,
            self::ENTITY_BON_COMMANDE,
            self::ENTITY_BON_LIVRAISON,
            self::ENTITY_MISSION,
            self::ENTITY_EQUIPMENT,
        ];
    }

    public static function fieldTypes(): array
    {
        return ['text', 'textarea', 'number', 'date', 'boolean', 'select'];
    }

    protected $fillable = [
        'entity_type',
        'code',
        'label',
        'field_type',
        'select_options',
        'sort_order',
        'required',
    ];

    protected function casts(): array
    {
        return [
            'select_options' => 'array',
            'required' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function values(): HasMany
    {
        return $this->hasMany(ExtrafieldValue::class, 'extrafield_definition_id');
    }
}
