@php
    $NAVY = '#1c3a6e';
    $LGRAY = '#f2f2f2';
    $BORDER = '#c0c0c0';
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ');
    $ctx = $pdfContext ?? [];
    $totalTtc = (float) ($ctx['total_ttc'] ?? $quote->amount_ttc ?? 0);
    $validite = $ctx['validite_label'] ?? ($quote->valid_until ? 'Jusqu\'au '.$quote->valid_until->format('d/m/Y') : '2 mois à compter de la date d\'envoi');
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Devis {{ $quote->number }}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef1f5;font-family:Arial,Helvetica,sans-serif;color:#111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f5;padding:28px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid #d8dee6;border-radius:4px;overflow:hidden;">

        {{-- Logo S2G (même en-tête que le PDF) --}}
        @if(!empty($letterheadPath) && is_readable($letterheadPath))
        <tr>
          <td style="padding:0 20px 10px;border-bottom:2px solid {{ $NAVY }};">
            <img
              src="{{ $message->embed($letterheadPath) }}"
              alt="S2G Laboratoire"
              width="560"
              style="display:block;width:100%;max-width:560px;height:auto;border:0;margin:0 auto;"
            />
          </td>
        </tr>
        @endif

        <tr>
          <td style="padding:20px 24px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border:1.5px solid {{ $NAVY }};text-align:center;padding:12px 16px;">
                  <span style="font-size:17px;font-weight:bold;color:#111;">Devis N°&nbsp;</span>
                  <span style="font-size:17px;font-weight:bold;color:{{ $NAVY }};">{{ $quote->number }}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 24px 24px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#222;">
              Bonjour <strong>{{ $recipientName }}</strong>,
            </p>

            @if(!empty($customMessage))
            <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#374151;white-space:pre-line;">{{ $customMessage }}</p>
            @endif

            <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#374151;">
              Veuillez trouver ci-joint notre devis détaillé. Ci-dessous un récapitulatif de l'offre&nbsp;:
            </p>

            {{-- Récapitulatif (aligné visuellement sur le PDF) --}}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;border:1px solid {{ $BORDER }};border-collapse:collapse;">
              @if($quote->client?->name)
              <tr>
                <td style="padding:10px 14px;width:34%;font-size:13px;font-weight:bold;color:#111;border-bottom:1px solid {{ $BORDER }};background:{{ $LGRAY }};">Client</td>
                <td style="padding:10px 14px;font-size:14px;color:#222;border-bottom:1px solid {{ $BORDER }};">{{ $quote->client->name }}</td>
              </tr>
              @endif
              @if(!empty($ctx['affaire']))
              <tr>
                <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#111;border-bottom:1px solid {{ $BORDER }};background:{{ $LGRAY }};">Affaire</td>
                <td style="padding:10px 14px;font-size:14px;color:#222;border-bottom:1px solid {{ $BORDER }};">{{ $ctx['affaire'] }}</td>
              </tr>
              @endif
              <tr>
                <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#111;border-bottom:1px solid {{ $BORDER }};background:{{ $LGRAY }};">Date</td>
                <td style="padding:10px 14px;font-size:14px;color:#222;border-bottom:1px solid {{ $BORDER }};">{{ $quote->quote_date->format('d/m/Y') }}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#111;border-bottom:1px solid {{ $BORDER }};background:{{ $LGRAY }};">Total TTC</td>
                <td style="padding:10px 14px;font-size:15px;font-weight:bold;color:{{ $NAVY }};border-bottom:1px solid {{ $BORDER }};">{{ $fmt($totalTtc) }} {{ $currencyLabel ?? 'DH' }}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#111;background:{{ $LGRAY }};">Validité</td>
                <td style="padding:10px 14px;font-size:14px;color:#222;">{{ $validite }}</td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;background:#f8fafc;border:1px solid #dbe3ec;border-radius:4px;">
              <tr>
                <td style="padding:14px 16px;font-size:14px;line-height:1.55;color:#374151;">
                  <strong style="color:{{ $NAVY }};">Pièce jointe</strong> — Le devis complet au format PDF est joint à cet email.
                </td>
              </tr>
            </table>

            <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#374151;">
              Pour toute question ou pour valider cette offre, vous pouvez répondre à cet email ou nous contacter aux coordonnées ci-dessous.
            </p>

            <p style="margin:0;font-size:15px;line-height:1.65;color:#374151;">
              Cordialement,<br/>
              <strong style="color:#111;">{{ $senderName ?? ($brandName ?? 'S2G') }}</strong><br/>
              <span style="font-size:13px;color:#6b7280;">{{ $brandName ?? 'S2G Laboratoire' }}</span>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 24px 24px;">
            @include('emails.partials.s2g-email-footer', ['NAVY' => $NAVY])
          </td>
        </tr>
      </table>

      <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;text-align:center;max-width:600px;">
        Message envoyé automatiquement — merci de ne pas répondre à une adresse noreply si indiquée par votre messagerie.
      </p>
    </td>
  </tr>
</table>
</body>
</html>
