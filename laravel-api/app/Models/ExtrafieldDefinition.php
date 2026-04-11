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

    public static function entityTypes(): array
    {
        return [
            self::ENTITY_CLIENT,
            self::ENTITY_SITE,
            self::ENTITY_ORDER,
            self::ENTITY_INVOICE,
            self::ENTITY_QUOTE,
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
