<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Devis {{ $quote->number }}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        {{-- Header --}}
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 100%);padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Devis commercial</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">{{ $brandName ?? 'Lab BTP' }}</h1>
          </td>
        </tr>

        {{-- Body --}}
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">Bonjour <strong>{{ $recipientName }}</strong>,</p>

            @if($customMessage)
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">{{ $customMessage }}</p>
            @endif

            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
              Veuillez trouver ci-joint notre devis pour votre projet.
            </p>

            {{-- Summary card --}}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;">Référence</td>
                      <td style="padding:6px 0;font-size:15px;font-weight:700;color:#1e40af;">{{ $quote->number }}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6b7280;">Montant TTC</td>
                      <td style="padding:6px 0;font-size:15px;font-weight:700;color:#111827;">{{ number_format($quote->amount_ttc ?? 0, 2, ',', ' ') }} {{ $currencyLabel ?? 'DH' }}</td>
                    </tr>
                    @if($quote->valid_until)
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6b7280;">Valable jusqu'au</td>
                      <td style="padding:6px 0;font-size:15px;color:#111827;">{{ $quote->valid_until->format('d/m/Y') }}</td>
                    </tr>
                    @endif
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
              N'hésitez pas à nous contacter pour toute question.
            </p>

            <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">
              Cordialement,<br>
              <strong style="color:#111827;">{{ auth()->user()?->name ?? ($brandName ?? 'Lab BTP') }}</strong>
            </p>
          </td>
        </tr>

        {{-- Footer --}}
        <tr>
          <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">
              {{ $brandName ?? 'Lab BTP' }} — Ce message est automatique, merci de ne pas y répondre directement.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
