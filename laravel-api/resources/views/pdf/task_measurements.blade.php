<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Mesures {{ $task->unique_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #172033; }
        h1 { font-size: 17px; color: #19375b; margin-bottom: 5px; }
        h2 { font-size: 12px; color: #19375b; margin-top: 22px; border-bottom: 1px solid #b9c9da; padding-bottom: 5px; }
        p { margin: 4px 0; }
        .meta { color: #506176; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #d6e0e9; padding: 6px 7px; text-align: left; vertical-align: top; }
        th { width: 34%; background: #f1f5f9; }
        .status { font-size: 9px; color: #526174; }
    </style>
</head>
<body>
    <h1>Mesures de la tâche {{ $task->unique_number ?? '#'.$task->id }}</h1>
    <p class="meta">{{ $task->ordreMissionLigne?->libelle ?? 'Tâche' }}</p>
    <p>Mission : {{ $task->ordreMissionLigne?->ordreMission?->numero ?? '—' }} · Client : {{ $task->ordreMissionLigne?->ordreMission?->client?->name ?? '—' }}</p>
    <p>Dossier : {{ $task->ordreMissionLigne?->ordreMission?->dossier?->reference ?? '—' }} · Technicien : {{ $task->assignedUser?->name ?? '—' }}</p>
    @if($task->measures->isNotEmpty())
        <h2>Mesures de l’action</h2>
        <table>
            @foreach($task->measures as $measure)
                <tr><th>{{ $measure->measureConfig?->field_name ?? 'Mesure' }}</th><td>{{ $measure->value_numeric ?? $measure->value ?? $measure->attachment_path ?? '—' }} {{ $measure->measureConfig?->unit ?? '' }}</td></tr>
            @endforeach
        </table>
    @endif
    @foreach($forms as $form)
        <h2>{{ $form['name'] }} <span class="status">{{ $form['status'] }}{{ $form['norm'] ? ' · '.$form['norm'] : '' }}</span></h2>
        <table>
            @foreach($form['rows'] as $row)
                <tr><th>{{ $row['label'] }}</th><td>{{ $row['value'] }} {{ $row['unit'] ?? '' }}</td></tr>
            @endforeach
        </table>
    @endforeach
    <p class="meta" style="margin-top:24px">Document généré le {{ now()->format('d/m/Y H:i') }} à partir des mesures enregistrées sur la tâche.</p>
</body>
</html>
