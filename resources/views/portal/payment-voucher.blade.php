<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Payment voucher {{ $voucher_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #1a1a1a; font-size: 13px; margin: 36px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        h2 { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; margin: 28px 0 10px; color: #444; }
        p { line-height: 1.45; margin: 0 0 8px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 7px 0; vertical-align: top; }
        td:first-child { width: 34%; color: #555; }
        .muted { color: #666; }
        .amount { font-size: 20px; font-weight: 700; margin-top: 8px; }
        .header { border-bottom: 1px solid #ddd; padding-bottom: 16px; margin-bottom: 20px; }
        .box { border: 1px solid #ddd; border-radius: 6px; padding: 14px 16px; margin-top: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <p class="muted">{{ $business_name }}</p>
        <h1>Payment voucher</h1>
        <p class="muted">{{ $voucher_number }} · {{ $paid_on }}</p>
    </div>

    <h2>Received from</h2>
    <table>
        <tr><td>Buyer</td><td>{{ $buyer_name }}</td></tr>
        <tr><td>Project</td><td>{{ $project_title }}</td></tr>
        <tr><td>Unit</td><td>{{ $unit_name }}</td></tr>
    </table>

    <h2>Payment</h2>
    <div class="box">
        <table>
            <tr><td>Amount</td><td class="amount">{{ $amount_formatted }}</td></tr>
            <tr><td>Method</td><td>{{ $method_label }}</td></tr>
            <tr><td>Reference</td><td>{{ $reference }}</td></tr>
            <tr><td>Paid on</td><td>{{ $paid_on }}</td></tr>
            @if ($notes)
                <tr><td>Notes</td><td>{{ $notes }}</td></tr>
            @endif
            @if (!empty($receipt_url))
                <tr><td>Proof</td><td><a href="{{ $receipt_url }}">View attached receipt</a></td></tr>
            @endif
        </table>
    </div>

    <p class="muted" style="margin-top: 28px;">
        This voucher confirms a payment recorded against the booking file. Keep it with the customer file.
    </p>
</body>
</html>
