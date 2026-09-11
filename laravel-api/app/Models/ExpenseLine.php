<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExpenseLine extends Model
{
    const CATEGORIES = ['Essence', 'Hotel', 'Voyage', 'Repas', 'Peage', 'Parking', 'Divers'];

    const PAYMENT_METHODS = ['especes', 'cb', 'virement', 'cheque', 'autre'];

    protected $fillable = [
        'expense_report_id',
        'user_id',
        'category',
        'amount',
        'payment_method',
        'date',
        'description',
        'receipt_path',
        'receipt_filename',
        'is_validated',
        'lieu_depart',
        'lieu_arrivee',
        'distance_km',
        'taux_km',
        'type_transport',
    ];

    protected $casts = [
        'amount'         => 'float',
        'date'           => 'date',
        'distance_km'    => 'float',
        'taux_km'        => 'float',
        'is_validated'   => 'boolean',
    ];

    public function isDeplacement(): bool
    {
        return $this->category === 'Voyage' && $this->distance_km !== null;
    }

    public function expenseReport(): BelongsTo
    {
        return $this->belongsTo(ExpenseReport::class, 'expense_report_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
