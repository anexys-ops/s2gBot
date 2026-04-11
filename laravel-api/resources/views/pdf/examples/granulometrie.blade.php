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
        .bar-wrap { height: 12px; background: #e2e8f0; }
        .bar { height: 12px; background: #059669; }
        .caption { margin-top: 14px; font-size: 9px; color: #475569; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <p class="note">Données fictives — courbe des passants cumulés (%) en fonction de la dimension de tamis (granulats).</p>
    <table>
        <thead>
            <tr>
                <th>Tamis</th>
                <th>% passant cumulé</th>
                <th>Visualisation</th>
            </tr>
        </thead>
        <tbody>
            @foreach($points as $p)
            <tr>
                <td>{{ $p['tamis'] }}</td>
                <td>{{ number_format($p['passant'], 1, ',', ' ') }} %</td>
                <td>
                    <div class="bar-wrap">
                        <div class="bar" style="width: {{ $p['passant'] }}%;"></div>
                    </div>
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>
    <p class="caption">En pratique, la courbe granulométrique relie les points (ouverture de tamis ; % passant) pour contrôler la continuité du squelette granulaire (NF EN 933-1 et annexes).</p>
    <p style="margin-top: 20px; font-size: 8px; color: #94a3b8;">Document généré par la plateforme Lab BTP — exemple téléchargeable.</p>
</body>
</html>
