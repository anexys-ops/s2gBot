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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TaskTestFormController extends Controller
{
    public function __construct(private readonly TaskFormAssignmentService $assignments) {}

    public function index(Request $request, MissionTask $task): JsonResponse
    {
        $this->authorizeTask($request, $task);
        $forms = $task->testForms()->with(['testType:id,name,norm', 'photos'])->get()->keyBy('test_type_id');

        return response()->json([
            'task_id' => $task->id,
            'forms' => $this->availableTypes($task)->map(fn (TestType $type) => [
                'test_type' => $type->only(['id', 'name', 'norm']),
                'form_fields' => $forms->get($type->id)?->form_snapshot['fields'] ?? $type->form_fields ?? [],
                'submission' => $forms->get($type->id),
            ])->values(),
        ]);
    }

    public function save(Request $request, MissionTask $task, TestType $testType): JsonResponse
    {
        $this->authorizeAssignee($request, $task);
        $this->assertAssignedType($task, $testType);
        $data = $request->validate(['answers' => 'required|array']);
        $form = DB::transaction(function () use ($task, $testType, $data) {
            $form = TaskTestForm::query()->firstOrCreate(
                ['mission_task_id' => $task->id, 'test_type_id' => $testType->id],
                ['status' => 'draft', 'form_snapshot' => $this->snapshot($testType), 'answers' => []],
            );
            abort_unless(in_array($form->status, ['draft', 'correction_requested'], true), 422, 'Ce formulaire ne peut plus être modifié.');
            $this->validateAnswers($form, $data['answers'], false);
            $form->update(['answers' => $data['answers'], 'status' => 'draft', 'correction_note' => null]);

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
        return ['name' => $testType->name, 'norm' => $testType->norm, 'fields' => $testType->form_fields ?? []];
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
            if ($value === null || $value === '') {
                if ($complete && ($field['required'] ?? false)) {
                    $errors["answers.$key"] = 'Champ requis.';
                }
                continue;
            }
            $valid = match ($field['type']) {
                'number' => is_numeric($value),
                'boolean' => is_bool($value),
                'date' => is_string($value) && (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $value),
                'select' => is_string($value) && in_array($value, $field['options'] ?? [], true),
                default => is_string($value),
            };
            if (! $valid) {
                $errors["answers.$key"] = 'Valeur invalide.';
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
