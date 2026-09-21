<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Booking form {{ $order->code }}</title>
    <style>
        body { font-family: Georgia, serif; color: #1a1a1a; margin: 40px auto; max-width: 760px; }
        h1 { font-size: 22px; margin-bottom: 0; }
        h2 { font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 28px; }
        p { line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 6px 0; vertical-align: top; }
        td:first-child { width: 34%; color: #555; }
        .muted { color: #666; }
        @media print { .no-print { display: none; } body { margin: 0; } }
    </style>
</head>
<body>
    <button class="no-print" onclick="window.print()">Print</button>
    <p class="muted">Provisional allotment</p>
    <h1>Booking form</h1>
    <p class="muted">{{ $order->code }} · {{ $order->booking_verified_at?->toFormattedDateString() ?? 'Draft' }}</p>

    <h2>Applicant</h2>
    <table>
        <tr><td>Name</td><td>{{ $order->contact?->display_name }}</td></tr>
        <tr><td>Identity</td><td>{{ strtoupper($deal['booking']['identity_kind'] ?? '') }} {{ $deal['booking']['identity_number'] }}</td></tr>
        <tr><td>Phone</td><td>{{ $deal['booking']['local_phone'] ?: $order->contact?->phone_number }}</td></tr>
        <tr><td>Overseas Pakistani</td><td>{{ ! empty($deal['booking']['overseas']) ? 'Yes' : 'No' }}</td></tr>
        <tr><td>Nominee</td><td>{{ $deal['booking']['nominee_name'] }} ({{ $deal['booking']['nominee_relation'] }}) · {{ $deal['booking']['nominee_cnic'] }}</td></tr>
    </table>

    <h2>Inventory</h2>
    <table>
        <tr><td>Project</td><td>{{ $order->project?->title }}</td></tr>
        <tr><td>Phase / block / sector</td><td>{{ $deal['booking']['phase'] }} / {{ $deal['booking']['block'] ?: '—' }} / {{ $deal['booking']['sector'] }}</td></tr>
        <tr><td>File or plot</td><td>{{ $deal['booking']['plot_or_file'] }}</td></tr>
        <tr><td>Category</td><td>{{ str_replace('_', ' ', (string) $deal['booking']['category']) }}</td></tr>
        <tr><td>Unit</td><td>{{ $order->unit?->code }}</td></tr>
    </table>

    <h2>Financials</h2>
    <table>
        <tr><td>Agreed price</td><td>{{ number_format((float) $order->agreed_price, 2) }}</td></tr>
        <tr><td>Premium</td><td>{{ number_format((float) $deal['booking']['premium'], 2) }}</td></tr>
        <tr><td>Discount</td><td>{{ number_format((float) $deal['booking']['discount'], 2) }}</td></tr>
        <tr><td>Net price</td><td>{{ number_format((float) $deal['net_price'], 2) }}</td></tr>
        <tr><td>Booking / token</td><td>{{ $order->booking_kind }}</td></tr>
    </table>

    <p>This provisional allotment letter is generated from the deal file and freezes the inventory against this buyer.</p>
</body>
</html>
