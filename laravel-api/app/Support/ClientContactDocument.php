<?php

namespace App\Support;

use App\Models\ClientContact;
use Illuminate\Validation\ValidationException;

/**
 * Vérifie qu'un contact commercial (ClientContact) appartient au même client qu'un document.
 */
final class ClientContactDocument
{
    public static function assertBelongsToClient(?int $contactId, int $clientId): void
    {
        if ($contactId === null) {
            return;
        }
        if (! ClientContact::query()
            ->whereKey($contactId)
            ->where('client_id', $clientId)
            ->exists()) {
            throw ValidationException::withMessages([
                'contact_id' => ['Le contact ne correspond pas au client du document.'],
            ]);
        }
    }
}
