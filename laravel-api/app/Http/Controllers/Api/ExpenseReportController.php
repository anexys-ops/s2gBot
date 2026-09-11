<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpenseLine;
use App\Models\ExpenseReport;
use App\Models\OrdreMission;
use App\Models\User;
use App\Support\UserExpenseBareme;
use App\Mail\ExpenseReportEmailMailable;
use App\Models\MailLog;
use App\Services\ExpenseReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExpenseReportController extends Controller
{
    // ── Liste des NDF ────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $q = ExpenseReport::with(['ordreMission.dossier', 'ordreMission.client', 'ordreMission.site', 'user', 'createdBy', 'validatedBy', 'lines'])
            ->withCount([
                'lines',
                'lines as lines_validated_count' => fn ($qb) => $qb->where('is_validated', true),
            ])
            ->when($request->statut, fn ($qb, $v) => $qb->where('statut', $v))
            ->when($request->ordre_mission_id, fn ($qb, $v) => $qb->where('ordre_mission_id', $v))
            ->when($request->search, function ($qb, $search) {
                $term = trim((string) $search);
                if ($term === '') {
                    return;
                }
                $like = '%'.$term.'%';
                $qb->where(function ($sub) use ($like) {
                    $sub->where('unique_number', 'like', $like)
                        ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', $like))
                        ->orWhereHas('ordreMission', function ($om) use ($like) {
                            $om->where('numero', 'like', $like)
                                ->orWhere('unique_number', 'like', $like)
                                ->orWhereHas('client', fn ($cq) => $cq->where('name', 'like', $like))
                                ->orWhereHas('dossier', function ($dq) use ($like) {
                                    $dq->where('reference', 'like', $like)
                                        ->orWhere('titre', 'like', $like);
                                })
                                ->orWhereHas('site', fn ($sq) => $sq->where('name', 'like', $like));
                        });
                });
            })
            ->orderByDesc('id');

        return response()->json($q->paginate(20));
    }

    // ── OMs éligibles pour créer une NDF (terrain/ingenieur) ─────────────────

    public function eligibleOrdresMission(): JsonResponse
    {
        $oms = OrdreMission::with(['dossier', 'client', 'site'])
            ->whereIn('type', [OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR])
            ->whereIn('statut', [
                OrdreMission::STATUT_PLANIFIE,
                OrdreMission::STATUT_EN_COURS,
                OrdreMission::STATUT_TERMINE,
            ])
            ->orderByDesc('id')
            ->get();

        return response()->json($oms);
    }

    // ── Créer une NDF ────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ordre_mission_id' => 'nullable|exists:ordres_mission,id',
            'user_id'          => 'nullable|exists:users,id',
            'notes'            => 'nullable|string',
        ]);

        if (empty($data['ordre_mission_id']) && empty($data['user_id'])) {
            $data['user_id'] = Auth::id();
        }

        $data['created_by'] = Auth::id();
        $data['statut']     = ExpenseReport::STATUT_BROUILLON;

        $report = ExpenseReport::create($data);
        $report->load(['ordreMission', 'user', 'createdBy', 'lines']);

        return response()->json($report, 201);
    }

    // ── Détail d'une NDF ─────────────────────────────────────────────────────

    public function show(ExpenseReport $expenseReport): JsonResponse
    {
        $expenseReport->load(['ordreMission.dossier', 'ordreMission.client', 'ordreMission.site', 'user', 'createdBy', 'validatedBy', 'lines.user']);
        $expenseReport->append('total');

        return response()->json($expenseReport);
    }

    // ── Modifier statut / notes ──────────────────────────────────────────────

    public function update(Request $request, ExpenseReport $expenseReport): JsonResponse
    {
        $data = $request->validate([
            'statut'         => 'sometimes|in:brouillon,soumis,valide,rembourse,rejete',
            'notes'          => 'nullable|string',
            'private_notes'  => 'nullable|string',
            'advance_amount' => 'nullable|numeric|min:0',
        ]);

        if (isset($data['statut']) && $data['statut'] === ExpenseReport::STATUT_VALIDE) {
            $data['validated_by'] = Auth::id();
            $data['validated_at'] = now();
        }

        $expenseReport->update($data);
        $expenseReport->load(['ordreMission', 'createdBy', 'validatedBy', 'lines']);
        $expenseReport->append('total');

        return response()->json($expenseReport);
    }

    // ── Supprimer (soft) ─────────────────────────────────────────────────────

    public function destroy(ExpenseReport $expenseReport): JsonResponse
    {
        abort_if(
            $expenseReport->statut === ExpenseReport::STATUT_REMBOURSE,
            422,
            'Une note de frais remboursée ne peut pas être supprimée.',
        );

        foreach ($expenseReport->lines as $line) {
            $this->deleteReceiptFile($line);
        }

        $expenseReport->delete();

        return response()->json(['message' => 'Supprimé']);
    }

    // ── Ajouter une ligne ────────────────────────────────────────────────────

    public function storeLine(Request $request, ExpenseReport $expenseReport, ExpenseReportService $expenseReports): JsonResponse
    {
        $this->ensureBrouillon($expenseReport);

        $data = $request->validate([
            'user_id'        => 'required|exists:users,id',
            'category'       => 'required|in:' . implode(',', ExpenseLine::CATEGORIES),
            'amount'         => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|in:' . implode(',', ExpenseLine::PAYMENT_METHODS),
            'date'           => 'required|date',
            'description'    => 'nullable|string|max:512',
            'lieu_depart'    => 'nullable|string|max:255',
            'lieu_arrivee'   => 'nullable|string|max:255',
            'distance_km'    => 'nullable|numeric|min:0',
            'taux_km'        => 'nullable|numeric|min:0',
            'type_transport' => 'nullable|in:voiture,moto,velo,transports_commun,autre',
        ]);

        $lineUser = User::query()->find($data['user_id']);
        $bareme = UserExpenseBareme::forUser($lineUser);

        if (
            isset($data['distance_km']) &&
            ($data['amount'] ?? null) === null
        ) {
            $data['amount'] = $expenseReports->computeDeplacementAmount(
                (float) $data['distance_km'],
                (float) ($data['taux_km'] ?? $bareme['taux_km']),
            );
        }

        if (! isset($data['taux_km']) && isset($data['distance_km'])) {
            $data['taux_km'] = $bareme['taux_km'];
        }

        if ($data['category'] === 'Repas' && $bareme['forfait_repas'] !== null && ($data['amount'] ?? 0) <= 0) {
            $data['amount'] = $bareme['forfait_repas'];
        }

        $data['amount'] = max(0, (float) ($data['amount'] ?? 0));
        $data['expense_report_id'] = $expenseReport->id;

        $line = ExpenseLine::create($data);

        return response()->json($line->load('user:id,name'), 201);
    }

    // ── Modifier une ligne ───────────────────────────────────────────────────

    public function updateLine(Request $request, ExpenseReport $expenseReport, ExpenseLine $line, ExpenseReportService $expenseReports): JsonResponse
    {
        $this->ensureLineBelongs($expenseReport, $line);

        $data = $request->validate([
            'user_id'        => 'sometimes|exists:users,id',
            'category'       => 'sometimes|in:' . implode(',', ExpenseLine::CATEGORIES),
            'amount'         => 'sometimes|numeric|min:0',
            'payment_method' => 'nullable|in:' . implode(',', ExpenseLine::PAYMENT_METHODS),
            'date'           => 'sometimes|date',
            'description'    => 'nullable|string|max:512',
            'is_validated'   => 'sometimes|boolean',
            'lieu_depart'    => 'nullable|string|max:255',
            'lieu_arrivee'   => 'nullable|string|max:255',
            'distance_km'    => 'nullable|numeric|min:0',
            'taux_km'        => 'nullable|numeric|min:0',
            'type_transport' => 'nullable|in:voiture,moto,velo,transports_commun,autre',
        ]);

        $this->ensureLineEditable($expenseReport, $data);

        if ($line->isDeplacement() || isset($data['distance_km'])) {
            $distance = (float) ($data['distance_km'] ?? $line->distance_km ?? 0);
            $lineUser = User::query()->find($data['user_id'] ?? $line->user_id);
            $taux = (float) ($data['taux_km'] ?? $line->taux_km ?? UserExpenseBareme::defaultTauxKm($lineUser));
            if (! array_key_exists('amount', $data)) {
                $data['amount'] = $expenseReports->computeDeplacementAmount($distance, $taux);
            }
        }

        $line->update($data);

        return response()->json($line->fresh()->load('user:id,name'));
    }

    // ── Supprimer une ligne ──────────────────────────────────────────────────

    public function destroyLine(ExpenseReport $expenseReport, ExpenseLine $line): JsonResponse
    {
        $this->ensureLineBelongs($expenseReport, $line);
        $this->ensureLineDeletable($expenseReport);

        $this->deleteReceiptFile($line);
        $line->delete();

        if (! $expenseReport->lines()->exists()) {
            $expenseReport->delete();
        }

        return response()->json(['message' => 'Ligne supprimée']);
    }

    // ── Justificatif (upload / téléchargement / suppression) ─────────────────

    public function uploadLineReceipt(Request $request, ExpenseReport $expenseReport, ExpenseLine $line): JsonResponse
    {
        $this->ensureLineBelongs($expenseReport, $line);
        $this->ensureBrouillon($expenseReport);

        $validated = $request->validate([
            'file' => 'required|file|max:10240|mimes:pdf,jpg,jpeg,png,webp',
        ]);

        $this->deleteReceiptFile($line);

        $file = $validated['file'];
        $path = $file->store("expense-receipts/{$expenseReport->id}/{$line->id}", 'local');

        $line->update([
            'receipt_path'     => $path,
            'receipt_filename' => $file->getClientOriginalName(),
        ]);

        return response()->json($line->fresh()->load('user:id,name'));
    }

    public function downloadLineReceipt(ExpenseReport $expenseReport, ExpenseLine $line): StreamedResponse|JsonResponse
    {
        $this->ensureLineBelongs($expenseReport, $line);

        if (! $line->receipt_path || ! Storage::disk('local')->exists($line->receipt_path)) {
            return response()->json(['message' => 'Justificatif absent'], 404);
        }

        return Storage::disk('local')->download(
            $line->receipt_path,
            $line->receipt_filename ?? 'justificatif',
        );
    }

    public function deleteLineReceipt(ExpenseReport $expenseReport, ExpenseLine $line): JsonResponse
    {
        $this->ensureLineBelongs($expenseReport, $line);
        $this->ensureBrouillon($expenseReport);

        $this->deleteReceiptFile($line);
        $line->update([
            'receipt_path'     => null,
            'receipt_filename' => null,
        ]);

        return response()->json($line->fresh()->load('user:id,name'));
    }

    public function sendEmail(Request $request, ExpenseReport $expenseReport): JsonResponse
    {
        $validated = $request->validate([
            'recipient_email' => 'required|email',
            'recipient_name'  => 'nullable|string|max:100',
            'message'         => 'nullable|string|max:2000',
            'pdf_template_id' => 'nullable|integer|exists:document_pdf_templates,id',
        ]);

        $mailer = (string) config('mail.default', 'log');
        if (in_array($mailer, ['log', 'array'], true)) {
            return response()->json([
                'message' => 'Envoi email impossible : le serveur SMTP n\'est pas configuré.',
            ], 503);
        }

        $recipientEmail = trim((string) $validated['recipient_email']);
        $recipientName = trim((string) ($validated['recipient_name'] ?? ''));
        if ($recipientName === '') {
            $recipientName = $recipientEmail;
        }

        $expenseReport->load(['ordreMission.client', 'ordreMission.dossier', 'ordreMission.site', 'lines.user', 'createdBy']);

        try {
            Mail::to($recipientEmail)->send(new ExpenseReportEmailMailable(
                $expenseReport,
                $recipientName,
                $validated['message'] ?? null,
                $request->user()->name,
                isset($validated['pdf_template_id']) ? (int) $validated['pdf_template_id'] : null,
            ));

            MailLog::create([
                'to'            => $recipientEmail,
                'subject'       => "Note de frais {$expenseReport->unique_number}",
                'template_name' => 'expense_report',
                'status'        => 'sent',
                'user_id'       => $request->user()->id,
                'sent_at'       => now(),
            ]);
        } catch (\Throwable $e) {
            MailLog::create([
                'to'            => $recipientEmail,
                'subject'       => "Note de frais {$expenseReport->unique_number}",
                'template_name' => 'expense_report',
                'status'        => 'failed',
                'error_message' => $e->getMessage(),
                'user_id'       => $request->user()->id,
                'sent_at'       => now(),
            ]);

            return response()->json(['message' => 'Échec envoi : '.$e->getMessage()], 500);
        }

        return response()->json(['message' => 'E-mail envoyé avec le PDF en pièce jointe']);
    }

    private function ensureBrouillon(ExpenseReport $expenseReport): void
    {
        abort_if(
            $expenseReport->statut !== ExpenseReport::STATUT_BROUILLON,
            422,
            'Cette note de frais n\'est plus modifiable.',
        );
    }

    private function ensureLineDeletable(ExpenseReport $expenseReport): void
    {
        abort_if(
            $expenseReport->statut === ExpenseReport::STATUT_REMBOURSE,
            422,
            'Impossible de supprimer une ligne sur une note de frais remboursée.',
        );
    }

    /** @param array<string, mixed> $data */
    private function ensureLineEditable(ExpenseReport $expenseReport, array $data): void
    {
        $keys = array_keys($data);
        $onlyValidation = $keys === ['is_validated'];
        if ($onlyValidation) {
            return;
        }

        $this->ensureBrouillon($expenseReport);
    }

    private function ensureLineBelongs(ExpenseReport $expenseReport, ExpenseLine $line): void
    {
        abort_if($line->expense_report_id !== $expenseReport->id, 404);
    }

    private function deleteReceiptFile(ExpenseLine $line): void
    {
        if ($line->receipt_path && Storage::disk('local')->exists($line->receipt_path)) {
            Storage::disk('local')->delete($line->receipt_path);
        }
    }
}
