<x-mail::message>
# Booking confirmation letter

Hello {{ $buyerName }},

Please find your booking confirmation letter attached as a PDF for **{{ $businessName }}**.

@if ($bookingNumber)
**Booking number:** {{ $bookingNumber }}
@endif
@if ($projectTitle)
**Project:** {{ $projectTitle }}
@endif
@if ($unitName)
**Unit:** {{ $unitName }}
@endif

If you have any questions, reply to this email or contact your sales representative.

Thanks,<br>
{{ $businessName }}
</x-mail::message>
