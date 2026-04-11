<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>{{ $title }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #1e293b; }
        h1 { font-size: 14px; margin-bottom: 8px; }
        .note { font-size: 9px; color: #64748b; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 5px; text-align: left; }
        th { background: #f1f5f9; }
        .bar-wrap { height: 14px; background: #e2e8f0; margin-top: 2px; }
        .bar { height: 14px; background: #2563eb; }
        .caption { margin-top: 14px; font-size: 9px; color: #475569; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <p class="note">Données fictives à titre d’exemple — σ (MPa) en fonction du palier de chargement (schéma type essai de compression sur éprouvette cylindrique).</p>
    <table>
        <thead>
            <tr>
                <th>Palier</th>
                <th>Contrainte σ (MPa)</th>
                <th>Représentation (échelle)</th>
            </tr>
        </thead>
        <tbody>
            @foreach($points as $p)
            <tr>
                <td>{{ $p['t'] }}</td>
                <td>{{ number_format($p['sigma'], 1, ',', ' ') }}</td>
                <td>
                    <div class="bar-wrap">
                        <div class="bar" style="width: {{ min(100, ($p['sigma'] / 42) * 100) }}%;"></div>
                    </div>
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>
    <p class="caption">La courbe contrainte–déformation réelle est obtenue en enregistrant la contrainte en fonction de la déformation axiale pendant l’essai (machine d’essai pilotée en déformation).</p>
    <p style="margin-top: 20px; font-size: 8px; color: #94a3b8;">Document généré par la plateforme Lab BTP — exemple téléchargeable.</p>
</body>
</html>
