{{-- Ligne devis : désignation + matériel inventaire (optionnel, si config) --}}
@php
    $eq = null;
    if (!empty($showEquipmentOnQuotePdf) && $line->relationLoaded('commercialOffering') && $line->commercialOffering) {
        $off = $line->commercialOffering;
        if ($off->relationLoaded('equipment') && $off->equipment) {
            $eq = $off->equipment;
        }
    }
@endphp
{{ $line->description }}
@if($eq)
<br><span class="muted" style="font-size: 8.5px;">Matériel : {{ $eq->name }}
@if(!empty($eq->numero_inventaire)) — Inv. {{ $eq->numero_inventaire }}@endif
@if(!empty($eq->serial_number)) — S/N {{ $eq->serial_number }}@endif
 — {{ $eq->code }}</span>
@endif
