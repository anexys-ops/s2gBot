{{-- Attend : $layoutConfig (tableau), $brandingLogoDataUri (nullable data URI), optionnel $formData pour photos --}}
@php
    $lc = $layoutConfig ?? [];
    $header = $lc['header'] ?? [];
    $showLogo = ($header['show_logo'] ?? true) !== false;
    $photoSlots = (int) ($header['photo_slots'] ?? 0);
@endphp
@if($showLogo && !empty($brandingLogoDataUri))
    <div style="margin-bottom:10px;">
        <img src="{{ $brandingLogoDataUri }}" alt="" style="max-height:48px;max-width:260px;"/>
    </div>
@endif
@if(!empty($header['subtitle']))
    <p class="meta" style="margin:4px 0 12px;color:#444;">{{ $header['subtitle'] }}</p>
@endif
@if($photoSlots > 0 && isset($formData) && is_array($formData))
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        @for($i = 1; $i <= $photoSlots; $i++)
            @php $k = 'photo_slot_'.$i; @endphp
            @if(!empty($formData[$k]) && is_string($formData[$k]))
                <div style="border:1px solid #ccc;padding:4px;">
                    <img src="{{ $formData[$k] }}" alt="" style="max-height:140px;max-width:200px;"/>
                </div>
            @endif
        @endfor
    </div>
@endif
