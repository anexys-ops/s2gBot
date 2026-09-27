<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\MissionTask;
use App\Models\TaskTestForm;
use App\Models\TaskTestFormPhoto;
use App\Models\TestType;
use App\Models\User;
use App\Services\MissionTaskClosureService;
use App\Services\TaskFormAssignmentService;
use App\Services\DynamicTestFormService;
use App\Services\TaskTestFormExcelGenerator;
use App\Services\TaskTestFormWordGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TaskTestFormController extends Controller
{
    public function __construct(
        private readonly TaskFormAssignmentService $assignments,
        private readonly DynamicTestFormService $dynamicForms,
    ) {}

    /**
     * Liste toutes les paires (tâche, essai assigné à son produit) pour le suivi labo —
     * y compris les essais pas encore commencés (aucun TaskTestForm créé), avec un statut
     * virtuel "not_started" côté frontend, sinon on ne verrait que les essais déjà touchés
     * au moins une fois (via l'appli mobile ou ce même écran).
     */
    public function indexAll(Request $request): JsonResponse
    {
        abort_unless($request->user()->isLab() || $request->user()->canValidateStatus(), 403);
        $data = $request->validate([
            'status' => 'nullable|in:not_started,draft,submitted,correction_requested,validated',
            'context' => 'nullable|in:terrain,ingenieur,labo',
            'page' => 'nullable|integer|min:1',
        ]);

        $pairs = DB::table('article_test_type as att')
            ->join('ordre_mission_lignes as oml', function ($join) {
                $join->on('oml.ref_article_id', '=', 'att.ref_article_id')
                    ->where(function ($q) {
                        $q->whereColumn('oml.article_action_id', 'att.article_action_id')
                            ->orWhereNull('att.article_action_id');
                    });
            })
            ->join('mission_tasks as mt', 'mt.ordre_mission_ligne_id', '=', 'oml.id')
            ->join('ordres_mission as om', 'om.id', '=', 'oml.ordre_mission_id')
            ->join('test_types as tt', 'tt.id', '=', 'att.test_type_id')
            ->leftJoin('task_test_forms as ttf', function ($join) {
                $join->on('ttf.mission_task_id', '=', 'mt.id')->on('ttf.test_type_id', '=', 'att.test_type_id');
            })
            ->whereNull('mt.deleted_at')
            ->where(function ($q) {
                $q->whereNull('tt.context')
                    ->orWhere(fn ($q2) => $q2->where('tt.context', 'terrain')->where('om.type', 'technicien'))
                    ->orWhere(fn ($q2) => $q2->where('tt.context', 'ingenieur')->where('om.type', 'ingenieur'))
                    ->orWhere(fn ($q2) => $q2->where('tt.context', 'labo')->where('om.type', 'labo'));
            })
            ->when($data['context'] ?? null, fn ($q, $context) => $q->where('tt.context', $context))
            ->when(($data['status'] ?? null) === 'not_started', fn ($q) => $q->whereNull('ttf.id'))
            ->when(in_array($data['status'] ?? null, ['draft', 'submitted', 'correction_requested', 'validated'], true),
                fn ($q) => $q->where('ttf.status', $data['status']))
            ->selectRaw('mt.id as task_id, att.test_type_id, ttf.id as form_id, ttf.status as form_status, COALESCE(ttf.updated_at, mt.updated_at) as sort_date')
            ->distinct()
            ->orderByDesc('sort_date');

        $page = $data['page'] ?? 1;
        $perPage = 30;
        $total = (clone $pairs)->get()->count();
        $rows = $pairs->forPage($page, $perPage)->get();

        $taskIds = $rows->pluck('task_id')->unique()->values();
        $typeIds = $rows->pluck('test_type_id')->unique()->values();

        $tasks = MissionTask::query()->whereIn('id', $taskIds)->with([
            'assignedUser:id,name',
            'samples:id,fold_number',
        ])->get()->keyBy('id');
        $types = TestType::query()->whereIn('id', $typeIds)->get(['id', 'name', 'norm', 'context'])->keyBy('id');

        $items = $rows->map(function ($row) use ($tasks, $types) {
            $task = $tasks->get($row->task_id);

            return [
                'id' => $row->form_id ?? "pending-{$row->task_id}-{$row->test_type_id}",
                'status' => $row->form_status ?? 'not_started',
                'test_type' => $types->get($row->test_type_id)?->only(['id', 'name', 'norm', 'context']),
                'task' => $task ? [
                    'id' => $task->id,
                    'unique_number' => $task->unique_number,
                    'assigned_user' => $task->assignedUser?->name,
                ] : null,
                'fold_numbers' => $task?->samples->pluck('fold_number')->filter()->values() ?? [],
                'pv_numbers' => $task?->pv_numbers ?? [],
                'updated_at' => $row->sort_date,
            ];
        })->values();

        return response()->json([
            'data' => $items,
            'current_page' => $page,
            'last_page' => (int) max(1, ceil($total / $perPage)),
            'per_page' => $perPage,
            'total' => $total,
        ]);
    }

    public function index(Request $request, MissionTask $task): JsonResponse
    {
        $this->authorizeTask($request, $task);
        $forms = $task->testForms()->with(['testType:id,name,norm', 'photos'])->get()->keyBy('test_type_id');

        return response()->json([
            'task_id' => $task->id,
            'forms' => $this->availableTypes($task)->map(fn (TestType $type) => [
                'test_type' => $type->only(['id', 'name', 'norm', 'description']),
                'form_fields' => $forms->get($type->id)?->form_snapshot['fields'] ?? $this->dynamicForms->resolvedFields($type->form_fields ?? []),
                'submission' => $forms->get($type->id),
            ])->values(),
        ]);
    }

    public function save(Request $request, MissionTask $task, TestType $testType): JsonResponse
    {
        $this->authorizeAssignee($request, $task);
        $this->assertAssignedType($task, $testType);
        $data = $request->validate(['answers' => 'present|array']);
        $form = DB::transaction(function () use ($task, $testType, $data) {
            $form = TaskTestForm::query()->firstOrCreate(
                ['mission_task_id' => $task->id, 'test_type_id' => $testType->id],
                ['status' => 'draft', 'form_snapshot' => $this->snapshot($testType), 'answers' => []],
            );
            abort_unless(in_array($form->status, ['draft', 'correction_requested'], true), 422, 'Ce formulaire ne peut plus être modifié.');
            $answers = $this->dynamicForms->calculateAnswers($form->form_snapshot['fields'] ?? [], $data['answers']);
            $this->validateAnswers($form, $answers, false);
            $form->update(['answers' => $answers, 'status' => 'draft', 'correction_note' => null]);

            return $form;
        });

        return response()->json($form->fresh('photos'));
    }

    public function submit(Request $request, MissionTask $task, TestType $testType): JsonResponse
    {
        $this->authorizeAssignee($request, $task);
        $this->assertAssignedType($task, $testType);
        $form = TaskTestForm::query()->where('mission_task_id', $task->id)->where('test_type_id', $testType->id)->firstOrFail();
        abort_unless($form->status === 'draft', 422, 'Le formulaire doit être en brouillon.');
        $this->validateAnswers($form, $form->answers ?? [], true);
        $form->update(['status' => 'submitted', 'submitted_by' => $request->user()->id, 'submitted_at' => now()]);

        return response()->json($form->fresh('photos'));
    }

    public function review(Request $request, MissionTask $task, TestType $testType, MissionTaskClosureService $closure): JsonResponse
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_LAB_ADMIN, User::ROLE_RESPONSABLE], true), 403);
        $this->assertAssignedType($task, $testType);
        $data = $request->validate([
            'decision' => 'required|in:validate,correction',
            'correction_note' => 'required_if:decision,correction|nullable|string|max:2000',
        ]);
        $form = TaskTestForm::query()->where('mission_task_id', $task->id)->where('test_type_id', $testType->id)->firstOrFail();
        abort_unless($form->status === 'submitted', 422, 'Seul un formulaire soumis peut être examiné.');
        abort_if($form->submitted_by === $request->user()->id, 403, 'Le rédacteur ne peut pas valider son propre formulaire.');

        DB::transaction(function () use ($form, $data, $request, $task, $closure) {
            if ($data['decision'] === 'correction') {
                $form->update(['status' => 'correction_requested', 'correction_note' => $data['correction_note']]);
                return;
            }
            $form->update(['status' => 'validated', 'validated_by' => $request->user()->id, 'validated_at' => now(), 'correction_note' => null]);
            if (! $this->assignments->hasPendingForms($task)) {
                $closure->validate($task, $request->user()->id);
            }
        });

        return response()->json($form->fresh('photos'));
    }

    public function uploadPhoto(Request $request, MissionTask $task, TestType $testType): JsonResponse
    {
        $this->authorizeAssignee($request, $task);
        $this->assertAssignedType($task, $testType);
        $data = $request->validate([
            'field_key' => 'required|string|max:100',
            'photo' => 'required|file|mimes:jpg,jpeg,png,webp,heic,heif|max:10240',
        ]);
        $form = TaskTestForm::query()->where('mission_task_id', $task->id)->where('test_type_id', $testType->id)->firstOrFail();
        abort_unless(in_array($form->status, ['draft', 'correction_requested'], true), 422);
        $fields = collect($form->form_snapshot['fields'] ?? []);
        abort_unless($fields->contains(fn (array $field) => $field['key'] === $data['field_key'] && $field['type'] === 'photo'), 422);
        $path = $data['photo']->store('task-test-forms/'.$form->id, 'local');
        $photo = $form->photos()->create([
            'field_key' => $data['field_key'],
            'path' => $path,
            'original_name' => $data['photo']->getClientOriginalName(),
            'mime_type' => $data['photo']->getMimeType(),
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json($photo, 201);
    }

    public function downloadPhoto(Request $request, TaskTestFormPhoto $photo): StreamedResponse
    {
        $this->authorizeTask($request, $photo->form->missionTask);
        return Storage::disk('local')->download($photo->path, $photo->original_name);
    }

    public function downloadWord(Request $request, MissionTask $task, TestType $testType, TaskTestFormWordGenerator $generator): \Illuminate\Http\Response
    {
        $this->authorizeTask($request, $task);
        $form = $this->assignedForm($task, $testType);
        [$content, $filename] = $generator->generate($form);

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function downloadExcel(Request $request, MissionTask $task, TestType $testType, TaskTestFormExcelGenerator $generator): \Illuminate\Http\Response
    {
        $this->authorizeTask($request, $task);
        $form = $this->assignedForm($task, $testType);
        [$content, $filename] = $generator->generate($form);

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function assignedForm(MissionTask $task, TestType $testType): TaskTestForm
    {
        $this->assertAssignedType($task, $testType);

        return TaskTestForm::query()
            ->where('mission_task_id', $task->id)
            ->where('test_type_id', $testType->id)
            ->firstOrFail();
    }

    public function deletePhoto(Request $request, TaskTestFormPhoto $photo): JsonResponse
    {
        $form = $photo->form;
        $this->authorizeAssignee($request, $form->missionTask);
        abort_unless(in_array($form->status, ['draft', 'correction_requested'], true), 422);
        Storage::disk('local')->delete($photo->path);
        $photo->delete();
        return response()->json(null, 204);
    }

    private function availableTypes(MissionTask $task)
    {
        return $this->assignments->typesFor($task);
    }

    private function assertAssignedType(MissionTask $task, TestType $testType): void
    {
        abort_unless($this->availableTypes($task)->contains('id', $testType->id), 404);
    }

    private function authorizeTask(Request $request, MissionTask $task): void
    {
        abort_unless($task->assigned_user_id === $request->user()->id
            || in_array($request->user()->role, [User::ROLE_LAB_ADMIN, User::ROLE_RESPONSABLE], true), 403);
    }

    private function authorizeAssignee(Request $request, MissionTask $task): void
    {
        abort_unless($task->assigned_user_id === $request->user()->id, 403);
        abort_if(in_array($task->statut, [MissionTask::STATUT_VALIDATED, MissionTask::STATUT_REJECTED], true), 422);
    }

    private function snapshot(TestType $testType): array
    {
        return ['name' => $testType->name, 'norm' => $testType->norm,
            'fields' => $this->dynamicForms->resolvedFields($testType->form_fields ?? [])];
    }

    private function validateAnswers(TaskTestForm $form, array $answers, bool $complete): void
    {
        $errors = [];
        $fields = collect($form->form_snapshot['fields'] ?? []);
        $keys = $fields->pluck('key')->all();
        foreach (array_keys($answers) as $key) {
            if (! in_array($key, $keys, true)) {
                $errors["answers.$key"] = 'Champ non prévu dans le formulaire.';
            }
        }
        foreach ($fields as $field) {
            $key = $field['key'];
            $value = $answers[$key] ?? null;
            if ($field['type'] === 'photo') {
                if ($complete && ($field['required'] ?? false) && ! $form->photos()->where('field_key', $key)->exists()) {
                    $errors["answers.$key"] = 'Photo requise.';
                }
                continue;
            }
            if ($field['type'] === 'table') {
                if (! is_array($value) || ! array_is_list($value)) {
                    $errors["answers.$key"] = 'Le tableau doit contenir des lignes.';
                    continue;
                }
                if ($complete && ($field['required'] ?? false) && $value === []) {
                    $errors["answers.$key"] = 'Ajoutez au moins une ligne.';
                }
                foreach ($value as $rowIndex => $row) {
                    if (! is_array($row)) {
                        $errors["answers.$key.$rowIndex"] = 'Ligne invalide.';
                        continue;
                    }
                    $columnKeys = array_column($field['columns'] ?? [], 'key');
                    foreach (array_keys($row) as $columnKey) {
                        if (! in_array($columnKey, $columnKeys, true)) $errors["answers.$key.$rowIndex.$columnKey"] = 'Colonne inconnue.';
                    }
                    foreach ($field['columns'] ?? [] as $column) {
                        $columnKey = $column['key'];
                        $error = $this->valueError($column, $row[$columnKey] ?? null, $complete);
                        if ($error) $errors["answers.$key.$rowIndex.$columnKey"] = $error;
                    }
                }
                continue;
            }
            $error = $this->valueError($field, $value, $complete);
            if ($error) $errors["answers.$key"] = $error;
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function valueError(array $field, mixed $value, bool $complete): ?string
    {
        if ($value === null || $value === '' || $value === []) {
            return $complete && ($field['required'] ?? false) ? 'Champ requis.' : null;
        }
        $valid = match ($field['type']) {
            'number', 'formula' => is_numeric($value),
            'boolean' => is_bool($value),
            'date' => is_string($value) && (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $value),
            'time' => is_string($value) && (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value),
            'duration' => is_string($value) && (bool) preg_match('/^\d{1,3}:[0-5]\d$/', $value),
            'select' => is_string($value) && in_array($value, $field['options'] ?? [], true),
            'checkboxes' => is_array($value) && array_is_list($value)
                && count($value) === count(array_unique($value))
                && collect($value)->every(fn ($item) => is_string($item) && in_array($item, $field['options'] ?? [], true)),
            default => is_string($value),
        };
        return $valid ? null : 'Valeur invalide.';
    }
}
