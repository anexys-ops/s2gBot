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
        th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
        th { background: #1e293b; color: #fff; }
        tr:nth-child(even) { background: #f8fafc; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <p class="note">Fiche fictive regroupant des résultats types — à ne pas utiliser pour une décision technique réelle.</p>
    <table>
        <thead>
            <tr>
                <th>Essai</th>
                <th>Norme</th>
                <th>Résultat</th>
                <th>Appréciation</th>
            </tr>
        </thead>
        <tbody>
            @foreach($lignes as $l)
            <tr>
                <td>{{ $l['essai'] }}</td>
                <td>{{ $l['norme'] }}</td>
                <td>{{ $l['resultat'] }}</td>
                <td>{{ $l['conformite'] }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    <p style="margin-top: 16px; font-size: 9px; color: #64748b;">Les rapports officiels sont émis par le laboratoire avec traçabilité, signatures et références d’échantillons.</p>
    <p style="margin-top: 20px; font-size: 8px; color: #94a3b8;">Document généré par la plateforme Lab BTP — exemple téléchargeable.</p>
</body>
</html>
