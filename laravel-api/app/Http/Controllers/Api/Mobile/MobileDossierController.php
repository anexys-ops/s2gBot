<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Support\AgencyAccess;
use App\Models\MobileDossierPhoto;
use App\Models\MobileMeasureSubmission;
use App\Models\ModuleSetting;
use App\Models\Order;
use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MobileDossierController extends Controller
{
    private const KINDS = ['order', 'site'];

    public function measureForms(Request $request, string $kind, int $id): JsonResponse
    {
        $this->resolveDossier($request, $kind, $id);

        $row = ModuleSetting::query()->where('module_key', 'mobile_labo_terrain')->first();
        $templates = $row?->settings['measure_form_templates'] ?? [];

        if (! is_array($templates) || $templates === []) {
            $templates = $this->fallbackMeasureFormTemplates();
        }

        return response()->json($templates);
    }

    public function storeMeasureSubmission(Request $request, string $kind, int $id): JsonResponse
    {
        $this->resolveDossier($request, $kind, $id);

        $validated = $request->validate([
            'form_template_id' => 'required|integer|min:1',
            'client_submission_id' => 'required|string|max:128',
            'submitted_at' => 'nullable|date',
            'values' => 'required|array',
        ]);

        $existing = MobileMeasureSubmission::query()
            ->where('client_submission_id', $validated['client_submission_id'])
            ->first();

        if ($existing) {
            if ((int) $existing->user_id !== (int) $request->user()->id) {
                return response()->json(['message' => 'Conflit idempotence'], 409);
            }
            if ($existing->dossier_kind !== $kind || (int) $existing->dossier_id !== $id) {
                return response()->json(['message' => 'Soumission déjà enregistrée pour un autre dossier'], 409);
            }

            return response()->json([
                'data' => [
                    'id' => $existing->id,
                    'synced_at' => $existing->updated_at?->toIso8601String(),
                ],
            ], 200);
        }

        $submission = MobileMeasureSubmission::create([
            'dossier_kind' => $kind,
            'dossier_id' => $id,
            'form_template_id' => $validated['form_template_id'],
            'client_submission_id' => $validated['client_submission_id'],
            'submitted_at' => $validated['submitted_at'] ?? now(),
            'values' => $validated['values'],
            'user_id' => $request->user()->id,
        ]);

        return response()->json([
            'data' => [
                'id' => $submission->id,
                'synced_at' => $submission->created_at->toIso8601String(),
            ],
        ], 201);
    }

    public function photos(Request $request, string $kind, int $id): JsonResponse
    {
        $model = $this->resolveDossier($request, $kind, $id);

        $attachments = $model->attachments()->orderByDesc('id')->get();
        $out = [];
        foreach ($attachments as $a) {
            $out[] = [
                'id' => $a->id,
                'url' => url('/api/attachments/'.$a->id.'/download'),
                'thumbnail_url' => null,
                'captured_at' => $a->created_at?->toIso8601String(),
                'synced_at' => $a->created_at?->toIso8601String(),
                'label' => $a->original_filename,
            ];
        }

        return response()->json($out);
    }

    public function storePhotoMeta(Request $request, string $kind, int $id): JsonResponse
    {
        $this->resolveDossier($request, $kind, $id);

        $validated = $request->validate([
            'filename' => 'required|string|max:255',
            'mime_type' => 'required|string|max:128',
            'captured_at' => 'nullable|date',
            'label' => 'nullable|string|max:500',
            'client_upload_id' => 'nullable|string|max:128',
        ]);

        if (! empty($validated['client_upload_id'])) {
            $dup = MobileDossierPhoto::query()
                ->where('client_upload_id', $validated['client_upload_id'])
                ->first();
            if ($dup) {
                if ($dup->dossier_kind !== $kind || (int) $dup->dossier_id !== $id) {
                    return response()->json(['message' => 'client_upload_id déjà utilisé'], 409);
                }

                return response()->json([
                    'data' => [
                        'id' => $dup->id,
                        'photo_id' => $dup->id,
                        'upload_url' => null,
                        'synced_at' => $dup->updated_at?->toIso8601String(),
                    ],
                ], 200);
            }
        }

        $row = MobileDossierPhoto::create([
            'dossier_kind' => $kind,
            'dossier_id' => $id,
            'filename' => $validated['filename'],
            'mime_type' => $validated['mime_type'],
            'captured_at' => $validated['captured_at'] ?? null,
            'label' => $validated['label'] ?? null,
            'client_upload_id' => $validated['client_upload_id'] ?? null,
            'user_id' => $request->user()->id,
        ]);

        return response()->json([
            'data' => [
                'id' => $row->id,
                'photo_id' => $row->id,
                'upload_url' => null,
                'synced_at' => $row->created_at->toIso8601String(),
                'hint' => 'Envoyer le fichier via POST /api/attachments (multipart) avec attachable_type '.($kind === 'order' ? 'order' : 'site').' et attachable_id '.$id.'.',
            ],
        ], 201);
    }

    /**
     * @return Order|Site
     */
    private function resolveDossier(Request $request, string $kind, int $id): Order|Site
    {
        if (! in_array($kind, self::KINDS, true)) {
            abort(404, 'Type de dossier inconnu');
        }

        if ($kind === 'order') {
            $order = Order::query()->find($id);
            if (! $order) {
                abort(404, 'Commande introuvable');
            }
            $this->assertCanAccessOrder($request, $order);

            return $order;
        }

        $site = Site::query()->find($id);
        if (! $site) {
            abort(404, 'Chantier introuvable');
        }
        $this->assertCanAccessSite($request, $site);

        return $site;
    }

    private function assertCanAccessOrder(Request $request, Order $order): void
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessOrder($user, $order)) {
            abort(403, 'Non autorisé');
        }
    }

    private function assertCanAccessSite(Request $request, Site $site): void
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessSite($user, $site)) {
            abort(403, 'Non autorisé');
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fallbackMeasureFormTemplates(): array
    {
        return [
            [
                'id' => 12,
                'name' => 'Essai Proctor (démo)',
                'fields' => [
                    [
                        'id' => 'f1',
                        'key' => 'water_content',
                        'label' => 'Teneur en eau',
                        'type' => 'number',
                        'required' => true,
                        'unit' => '%',
                        'order' => 10,
                        'options' => null,
                        'validation' => ['min' => 0, 'max' => 100],
                    ],
                ],
            ],
        ];
    }
}
