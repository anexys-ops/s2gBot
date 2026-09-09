<p>Bonjour {{ $recipientName }},</p>

@if($customMessage)
<p>{!! nl2br(e($customMessage)) !!}</p>
@else
<p>Veuillez trouver ci-joint la note de frais <strong>{{ $report->unique_number }}</strong>.</p>
@endif

<p>
    Total TTC : <strong>{{ number_format((float) ($report->total ?? 0), 2, ',', ' ') }} {{ $currencyLabel }}</strong>
    @if(($report->advance_amount ?? 0) > 0)
        · Acompte : {{ number_format((float) $report->advance_amount, 2, ',', ' ') }} {{ $currencyLabel }}
    @endif
</p>

<p>Cordialement,<br>{{ $senderName ?? $brandName }}</p>
