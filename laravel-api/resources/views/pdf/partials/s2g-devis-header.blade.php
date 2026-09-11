@php
    $letterhead = $letterheadDataUri ?? $brandingLogoDataUri ?? null;
@endphp
<div style="border-bottom:2px solid #1c3a6e;padding-bottom:6px;margin-bottom:12px;">
    @if($letterhead)
        <img src="{{ $letterhead }}" alt="S2G" style="width:100%;max-height:90px;display:block;"/>
    @else
        <strong style="font-size:14pt;color:#1c3a6e;">S2G Laboratoire</strong>
    @endif
</div>
