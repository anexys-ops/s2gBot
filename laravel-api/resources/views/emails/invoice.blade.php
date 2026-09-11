@php
    $NAVY = '#1c3a6e';
    $LGRAY = '#f2f2f2';
    $BORDER = '#c0c0c0';
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ');
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Facture {{ $invoice->number }}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background-color:#ffffff;">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #d8dee6;">
        <tr>
          <td style="padding:28px 32px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border:1.5px solid {{ $NAVY }};text-align:center;padding:12px 16px;">
                  <span style="font-size:17px;font-weight:bold;color:#111;">Facture N°&nbsp;</span>
                  <span style="font-size:17px;font-weight:bold;color:{{ $NAVY }};">{{ $invoice->number }}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 32px 28px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#222;">
              Bonjour <strong>{{ $recipientName }}</strong>,
            </p>
            @if(!empty($customMessage))
            <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#374151;white-space:pre-line;">{{ $customMessage }}</p>
            @endif
            <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#374151;">
              Veuillez trouver ci-joint notre facture au format PDF.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid {{ $BORDER }};border-collapse:collapse;">
              @if($invoice->client?->name)
              <tr>
                <td style="padding:10px 14px;width:34%;font-size:13px;font-weight:bold;color:#111;border-bottom:1px solid {{ $BORDER }};background:{{ $LGRAY }};">Client</td>
                <td style="padding:10px 14px;font-size:14px;color:#222;border-bottom:1px solid {{ $BORDER }};">{{ $invoice->client->name }}</td>
              </tr>
              @endif
              <tr>
                <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#111;border-bottom:1px solid {{ $BORDER }};background:{{ $LGRAY }};">Date</td>
                <td style="padding:10px 14px;font-size:14px;color:#222;border-bottom:1px solid {{ $BORDER }};">{{ $invoice->invoice_date->format('d/m/Y') }}</td>
              </tr>
              @if($invoice->due_date)
              <tr>
                <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#111;border-bottom:1px solid {{ $BORDER }};background:{{ $LGRAY }};">Échéance</td>
                <td style="padding:10px 14px;font-size:14px;color:#222;border-bottom:1px solid {{ $BORDER }};">{{ $invoice->due_date->format('d/m/Y') }}</td>
              </tr>
              @endif
              <tr>
                <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#111;background:{{ $LGRAY }};">Total TTC</td>
                <td style="padding:10px 14px;font-size:15px;font-weight:bold;color:{{ $NAVY }};">{{ $fmt($invoice->amount_ttc) }} {{ $currencyLabel ?? 'DH' }}</td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:15px;line-height:1.65;color:#374151;">
              Cordialement,<br/>
              <strong style="color:#111;">{{ $senderName ?? ($brandName ?? 'S2G') }}</strong><br/>
              <span style="font-size:13px;color:#6b7280;">{{ $brandName ?? 'S2G Laboratoire' }}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 32px;">
            @include('emails.partials.s2g-email-footer', ['NAVY' => $NAVY])
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
