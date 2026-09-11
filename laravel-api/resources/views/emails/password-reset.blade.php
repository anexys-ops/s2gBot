@php
    $NAVY = '#1c3a6e';
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Réinitialisation mot de passe</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #d8dee6;border-radius:8px;">
        <tr>
          <td style="padding:28px 32px 8px;">
            <h1 style="margin:0 0 12px;font-size:22px;color:{{ $NAVY }};">Réinitialisation du mot de passe</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">
              Bonjour {{ $user->name }},<br>
              Vous avez demandé la réinitialisation de votre mot de passe sur <strong>{{ $brandName }}</strong>.
            </p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">
              Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 60 minutes.
            </p>
            <p style="margin:0 0 24px;text-align:center;">
              <a href="{{ $resetUrl }}" style="display:inline-block;padding:12px 22px;background:{{ $NAVY }};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
                Choisir un nouveau mot de passe
              </a>
            </p>
            <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#64748b;word-break:break-all;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
              <a href="{{ $resetUrl }}" style="color:{{ $NAVY }};">{{ $resetUrl }}</a>
            </p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">
              Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 24px;">
            @include('emails.partials.s2g-email-footer')
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
