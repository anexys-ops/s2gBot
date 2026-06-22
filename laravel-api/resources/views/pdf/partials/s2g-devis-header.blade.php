@php
    $letterhead = $letterheadDataUri ?? $brandingLogoDataUri ?? null;
@endphp
<table style="width:100%;border-collapse:collapse;border-bottom:2px solid #1c3a6e;margin-bottom:12px;">
    <tr>
        <td style="vertical-align:middle;padding-bottom:6px;">
            @if($letterhead)
                <img src="{{ $letterhead }}" alt="S2G" style="width:100%;max-height:72px;display:block;"/>
            @else
                <strong style="font-size:14pt;color:#1c3a6e;">S2G Laboratoire</strong>
            @endif
        </td>
        <td style="vertical-align:top;width:52px;border-left:1px solid #c0c0c0;padding:0 0 6px 5px;font-size:7pt;color:#444;line-height:1.5;text-align:center;">
            En-T-05-01 /v : 03<br/>Màj:19/08/2025
        </td>
    </tr>
</table>
