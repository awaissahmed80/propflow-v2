<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Payment request {{ $voucher_number }}</title>
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
        <h1>Payment request</h1>
        <p class="muted">{{ $voucher_number }} · Due {{ $due_on }}</p>
    </div>

    <h2>Bill to</h2>
    <table>
        <tr><td>Buyer</td><td>{{ $buyer_name }}</td></tr>
        <tr><td>Project</td><td>{{ $project_title }}</td></tr>
        <tr><td>Unit</td><td>{{ $unit_name }}</td></tr>
        <tr><td>Installment</td><td>{{ $installment_label }}</td></tr>
    </table>

    <h2>Amount due</h2>
    <div class="box">
        <table>
            <tr><td>Amount</td><td class="amount">{{ $amount_formatted }}</td></tr>
            <tr><td>Due on</td><td>{{ $due_on }}</td></tr>
        </table>
    </div>

    <h2>Remit to</h2>
    <div class="box">
        <table>
            <tr><td>Company</td><td>{{ $business_name }}</td></tr>
            <tr><td>Bank</td><td>{{ $bank['bank_name'] ?: '—' }}</td></tr>
            <tr><td>Account title</td><td>{{ $bank['account_title'] ?: '—' }}</td></tr>
            <tr><td>Account number</td><td>{{ $bank['account_number'] ?: '—' }}</td></tr>
            @if (!empty($bank['iban']))
                <tr><td>IBAN</td><td>{{ $bank['iban'] }}</td></tr>
            @endif
            @if (!empty($bank['swift']))
                <tr><td>SWIFT</td><td>{{ $bank['swift'] }}</td></tr>
            @endif
            @if (!empty($bank['branch']))
                <tr><td>Branch</td><td>{{ $bank['branch'] }}</td></tr>
            @endif
        </table>
    </div>

    <p class="muted" style="margin-top: 28px;">
        Please remittance using the bank details above and share the payment proof with your sales representative.
    </p>
</body>
</html>
