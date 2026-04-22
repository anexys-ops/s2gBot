<?php

namespace App\Services;

use App\Models\DocumentStatusHistory;
use App\Models\User;

class DocumentStatusService
{
    public function record(
        string $documentType,
        int $documentId,
        ?string $etatAvant,
        string $etatApres,
        User $user,
        string $source = DocumentStatusHistory::SOURCE_MANUEL,
        ?string $commentaire = null
    ): DocumentStatusHistory {
        return DocumentStatusHistory::query()->create([
            'document_type' => $documentType,
            'document_id' => $documentId,
            'etat_avant' => $etatAvant,
            'etat_apres' => $etatApres,
            'user_id' => $user->id,
            'source' => $source,
            'commentaire' => $commentaire,
        ]);
    }
}
