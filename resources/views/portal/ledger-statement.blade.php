<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light">
    <title>Installment plan {{ $order->code }}</title>
    <style>
        :root { color-scheme: light only; }
        html, body { background: #ffffff; }
        body { font-family: DejaVu Sans, sans-serif; color: #1a1a1a; font-size: 12px; margin: 28px; }
        h1 { font-size: 20px; margin: 0 0 4px; color: #1a1a1a; }
        p { line-height: 1.45; margin: 0 0 6px; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border-bottom: 1px solid #e5e5e5; padding: 8px 6px; text-align: left; color: #1a1a1a; }
        th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
        td.num, th.num { text-align: right; }
        .muted { color: #666; }
        .header { border-bottom: 1px solid #ddd; padding-bottom: 14px; margin-bottom: 16px; }
        .totals td { font-weight: 700; border-bottom: none; padding-top: 12px; }
        @media print {
            html, body { background: #ffffff; }
        }
    </style>
</head>
<body>
    <div class="header">
        <p class="muted">{{ $business_name }}</p>
        <h1>Installment plan</h1>
        <p class="muted">
            {{ $order->code }}
            · {{ $order->contact?->display_name ?: 'Buyer' }}
            · {{ $order->project?->title ?: 'Project' }}
            · {{ $order->unit?->name ?: ($order->unit?->code ?: 'Unit') }}
        </p>
    </div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Label</th>
                <th>Due</th>
                <th>Status</th>
                <th class="num">Amount</th>
                <th class="num">Paid</th>
                <th class="num">Late fee</th>
                <th class="num">Remaining</th>
            </tr>
        </thead>
        <tbody>
            @foreach (($deal['installments'] ?? []) as $row)
                <tr>
                    <td>{{ $row['sequence'] }}</td>
                    <td>{{ $row['label'] }}</td>
                    <td>{{ $row['due_on'] ?: '—' }}</td>
                    <td>{{ ucfirst($row['status']) }}{{ !empty($row['overdue']) ? ' · overdue' : '' }}</td>
                    <td class="num">{{ $currency_symbol }}{{ number_format((float) $row['amount'], 2) }}</td>
                    <td class="num">{{ $currency_symbol }}{{ number_format((float) $row['paid_amount'], 2) }}</td>
                    <td class="num">{{ $currency_symbol }}{{ number_format((float) $row['late_fee'], 2) }}</td>
                    <td class="num">{{ $currency_symbol }}{{ number_format((float) $row['remaining'], 2) }}</td>
                </tr>
            @endforeach
            @php $totals = $deal['installment_totals'] ?? []; @endphp
            <tr class="totals">
                <td colspan="4">Totals</td>
                <td class="num">{{ $currency_symbol }}{{ number_format((float) ($totals['scheduled'] ?? 0), 2) }}</td>
                <td class="num">{{ $currency_symbol }}{{ number_format((float) ($totals['paid'] ?? 0), 2) }}</td>
                <td class="num">{{ $currency_symbol }}{{ number_format((float) ($totals['late_fees'] ?? 0), 2) }}</td>
                <td class="num">{{ $currency_symbol }}{{ number_format((float) ($totals['remaining'] ?? 0), 2) }}</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
