<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
  .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
  .body { padding: 24px; }
  .cta { background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 16px 0; }
  .footer { padding: 16px 24px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  .quote-ref { font-size: 1.1em; font-weight: bold; color: #1e40af; }
</style>
</head>
<body>
<div class="header">
  <h1>{{ config('app.name', 'Lab BTP') }}</h1>
</div>
<div class="body">
  <p>Bonjour {{ $recipientName }},</p>

  @if($customMessage)
  <p>{{ $customMessage }}</p>
  @endif

  <p>Veuillez trouver ci-joint notre devis <span class="quote-ref">{{ $quote->number }}</span> d'un montant de <strong>{{ number_format($quote->amount_ttc ?? 0, 2, ',', ' ') }} {{ $currencyLabel ?? 'DH' }} TTC</strong>.</p>

  <p>Ce devis est valable jusqu'au {{ $quote->valid_until ? \Carbon\Carbon::parse($quote->valid_until)->format('d/m/Y') : 'date non spécifiée' }}.</p>

  <p>N'hésitez pas à nous contacter pour toute question.</p>

  <p>Cordialement,<br>
  <strong>{{ auth()->user()?->name ?? config('app.name') }}</strong>
  </p>
</div>
<div class="footer">
  {{ config('app.name') }} — Ce message est automatique, merci de ne pas y répondre directement.
</div>
</body>
</html>
