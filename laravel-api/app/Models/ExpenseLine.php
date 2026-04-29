<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExpenseLine extends Model
{
    const CATEGORIES = ['Essence', 'Hotel', 'Voyage', 'Repas', 'Peage', 'Parking', 'Divers'];

    protected $fillable = [
        'expense_report_id',
        'user_id',
        'category',
        'amount',
        'date',
        'description',
        'receipt_path',
    ];

    protected $casts = [
        'amount' => 'float',
        'date'   => 'date',
    ];

    public function expenseReport(): BelongsTo
    {
        return $this->belongsTo(ExpenseReport::class, 'expense_report_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class);
    }
}
