<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light">
    <title>Booking Confirmation Letter — {{ $order->contact?->display_name ?: 'Buyer' }}</title>
    <style>
        @page { size: A4; margin: 12mm; }
        :root { color-scheme: light only; }
        html, body { background: #ffffff; }
        body {
            font-family: DejaVu Sans, sans-serif;
            color: #1c1917;
            font-size: 10px;
            line-height: 1.4;
            margin: 0;
        }
        @if (! empty($preview))
        @media screen {
            html {
                height: 100%;
                background: #ffffff;
            }
            body {
                box-sizing: border-box;
                min-height: 100%;
                padding: 12mm;
            }
        }
        @endif
        p { margin: 0; color: #1c1917; }
        table { width: 100%; border-collapse: collapse; }
        .top-rule {
            height: 3px;
            background: #1c1917;
            margin: 0 0 10px;
        }
        .accent-rule {
            height: 1px;
            background: #a8a29e;
            margin: 0 0 12px;
        }
        .letterhead-table td { padding: 0; vertical-align: top; color: #1c1917; }
        .logo { max-height: 42px; max-width: 110px; }
        .company-name {
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin: 0 0 2px;
            color: #0c0a09;
        }
        .tagline {
            font-size: 9px;
            color: #57534e;
            margin: 0 0 4px;
        }
        .company-meta {
            font-size: 8.5px;
            color: #57534e;
            line-height: 1.45;
        }
        .ref-block {
            text-align: right;
            font-size: 8.5px;
            color: #57534e;
            line-height: 1.5;
            white-space: nowrap;
        }
        .ref-block strong {
            display: block;
            color: #0c0a09;
            font-size: 9px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .doc-title {
            text-align: center;
            margin: 0 0 10px;
            padding: 8px 0 7px;
            border-top: 1px solid #1c1917;
            border-bottom: 1px solid #1c1917;
        }
        .doc-title h1 {
            margin: 0;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #0c0a09;
        }
        .doc-meta {
            margin-top: 3px;
            font-size: 8.5px;
            color: #57534e;
            letter-spacing: 0.02em;
        }
        .intro {
            margin: 0 0 10px;
            color: #44403c;
            text-align: justify;
            font-size: 9.5px;
        }
        .section { margin: 0 0 8px; }
        .section-heading {
            margin: 0 0 4px;
            padding: 0 0 3px;
            border-bottom: 1px solid #d6d3d1;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #0c0a09;
        }
        .fields td {
            padding: 3px 0;
            vertical-align: top;
            border-bottom: 1px solid #f5f5f4;
            color: #1c1917;
            font-size: 9.5px;
        }
        .fields tr:last-child td { border-bottom: none; }
        .fields td.label {
            width: 30%;
            color: #78716c;
            font-size: 8.5px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding-right: 8px;
        }
        .fields td.value { font-weight: 500; }
        .two-col td.col { width: 50%; vertical-align: top; padding: 0; }
        .two-col td.col + td.col { padding-left: 14px; }
        .amount { font-weight: 700; }
        .net-row td {
            border-top: 1px solid #1c1917 !important;
            border-bottom: none !important;
            padding-top: 5px !important;
            font-weight: 700;
        }
        .declaration {
            margin: 8px 0 0;
            padding: 7px 9px;
            border: 1px solid #e7e5e4;
            background: #fafaf9;
            color: #44403c;
            font-size: 8.5px;
            text-align: justify;
        }
        .signatures {
            width: 100%;
            margin-top: 22px;
        }
        .signatures td {
            width: 46%;
            vertical-align: top;
            color: #57534e;
            font-size: 8.5px;
        }
        .signatures td.gap { width: 8%; }
        .sig-line {
            border-top: 1px solid #78716c;
            margin-top: 28px;
            padding-top: 4px;
            letter-spacing: 0.02em;
        }
        .footer-note {
            margin-top: 14px;
            padding-top: 6px;
            border-top: 1px solid #e7e5e4;
            font-size: 8px;
            color: #a8a29e;
            text-align: center;
            letter-spacing: 0.03em;
        }
        @media print {
            html, body { background: #ffffff; }
            @page { size: A4; margin: 12mm; }
        }
    </style>
</head>
<body>
    @php
        $company = $company ?? [];
        $displayName = filled($company['legal_name'] ?? null)
            ? $company['legal_name']
            : ($company['business_name'] ?? ($business_name ?? config('app.name')));
        $booking = $deal['booking'] ?? [];
        $symbol = $currency_symbol ?? '$';
        $contactName = filled($booking['customer_legal_name'] ?? null)
            ? $booking['customer_legal_name']
            : ($order->customer_legal_name ?: ($order->contact?->display_name ?: 'Buyer'));
        $unitName = $order->unit?->name ?: '—';
        $blockTitle = $order->unit?->block?->title
            ?: ($booking['block'] ?? null)
            ?: '—';
        $addressParts = array_filter([
            $company['address'] ?? null,
            $company['city'] ?? null,
            $company['state'] ?? null,
        ]);
        $contactLines = array_filter([
            $company['phone'] ?? null,
            $company['email'] ?? null,
            $company['website'] ?? null,
        ]);
        $identityKind = strtoupper((string) ($booking['identity_kind'] ?? ''));
        $identityNumber = $booking['identity_number'] ?? null;
        $category = str_replace('_', ' ', (string) ($booking['category'] ?? ''));
        $bookedOn = $order->booked_at?->toFormattedDateString()
            ?: ($order->booking_verified_at?->toFormattedDateString() ?: 'Draft');
        $bookingKind = ucfirst((string) ($order->booking_kind ?: 'token'));
        $identityLine = ($identityKind || $identityNumber)
            ? trim($identityKind.' '.($identityNumber ?: ''))
            : '—';
        $nomineeLine = filled($booking['nominee_name'] ?? null)
            ? trim(
                $booking['nominee_name']
                .(filled($booking['nominee_relation'] ?? null) ? ' ('.$booking['nominee_relation'].')' : '')
                .(filled($booking['nominee_cnic'] ?? null) ? ' · '.$booking['nominee_cnic'] : '')
            )
            : '—';
    @endphp

    <div class="top-rule"></div>

    <table class="letterhead-table" style="margin-bottom: 8px;">
        <tr>
            @if (!empty($company['logo_url']))
                <td style="width: 120px; padding-right: 12px;">
                    <img class="logo" src="{{ $company['logo_url'] }}" alt="{{ $displayName }}">
                </td>
            @endif
            <td>
                <p class="company-name">{{ $displayName }}</p>
                @if (filled($company['tagline'] ?? null))
                    <p class="tagline">{{ $company['tagline'] }}</p>
                @endif
                @if ($addressParts !== [])
                    <p class="company-meta">{{ implode(', ', $addressParts) }}</p>
                @endif
                @if ($contactLines !== [])
                    <p class="company-meta">{{ implode('  ·  ', $contactLines) }}</p>
                @endif
            </td>
            <td class="ref-block">
                <strong>Document</strong>
                Booking confirmation<br>
                Dated {{ $bookedOn }}
                @if (filled($order->booking_number))
                    <br>Ref. {{ $order->booking_number }}
                @elseif (filled($order->code))
                    <br>Ref. {{ $order->code }}
                @endif
            </td>
        </tr>
    </table>

    <div class="accent-rule"></div>

    <div class="doc-title">
        <h1>Booking Confirmation Letter</h1>
        <p class="doc-meta">
            {{ $contactName }} · {{ $order->project?->title ?: 'Project' }} · {{ $unitName }}
        </p>
    </div>

    <p class="intro">
        This letter confirms that the unit described below is booked and reserved in favour of
        the applicant, subject to the company’s terms, payment obligations, and completion of required
        documentation to the satisfaction of {{ $displayName }}.
    </p>

    <table class="two-col" style="margin-bottom: 8px;">
        <tr>
            <td class="col">
                <div class="section">
                    <p class="section-heading">Applicant</p>
                    <table class="fields">
                        <tr><td class="label">Name</td><td class="value">{{ $contactName }}</td></tr>
                        <tr><td class="label">Identity</td><td class="value">{{ $identityLine }}</td></tr>
                        <tr>
                            <td class="label">Phone</td>
                            <td class="value">
                                {{ ($booking['international_phone'] ?? null) ?: ($order->contact?->phone_number ?: '—') }}
                                @if (filled($booking['local_phone'] ?? null) || filled($order->contact?->phone_number_alt))
                                    <br />Alt: {{ ($booking['local_phone'] ?? null) ?: ($order->contact?->phone_number_alt ?: '—') }}
                                @endif
                            </td>
                        </tr>
                        @if (filled($order->contact?->email_address))
                            <tr><td class="label">Email</td><td class="value">{{ $order->contact->email_address }}</td></tr>
                        @endif
                        <tr><td class="label">Overseas</td><td class="value">{{ ! empty($booking['overseas']) ? 'Yes' : 'No' }}</td></tr>
                        <tr><td class="label">Nominee</td><td class="value">{{ $nomineeLine }}</td></tr>
                    </table>
                </div>
            </td>
            <td class="col">
                <div class="section">
                    <p class="section-heading">Property</p>
                    <table class="fields">
                        <tr><td class="label">Project</td><td class="value">{{ $order->project?->title ?: '—' }}</td></tr>
                        <tr>
                            <td class="label">Location</td>
                            <td class="value">
                                {{ ($booking['phase'] ?? null) ?: '—' }}
                                / {{ $blockTitle }}
                                / {{ ($booking['sector'] ?? null) ?: ($order->unit?->sector ?: '—') }}
                            </td>
                        </tr>
                        <tr><td class="label">Unit</td><td class="value">{{ $unitName }}</td></tr>
                        <tr><td class="label">File / plot</td><td class="value">{{ ($booking['plot_or_file'] ?? null) ?: '—' }}</td></tr>
                        <tr><td class="label">Category</td><td class="value">{{ filled($category) ? ucwords($category) : '—' }}</td></tr>
                        <tr><td class="label">Type</td><td class="value">{{ $bookingKind }}</td></tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>

    <div class="section">
        <p class="section-heading">Financial summary</p>
        <table class="fields">
            <tr>
                <td class="label">Agreed price</td>
                <td class="value amount">{{ $symbol }}{{ number_format((float) $order->agreed_price, 2) }}</td>
                <td class="label">Premium</td>
                <td class="value">{{ $symbol }}{{ number_format((float) ($booking['premium'] ?? 0), 2) }}</td>
            </tr>
            <tr>
                <td class="label">Discount</td>
                <td class="value">{{ $symbol }}{{ number_format((float) ($booking['discount'] ?? 0), 2) }}</td>
                <td class="label">Net payable</td>
                <td class="value amount">{{ $symbol }}{{ number_format((float) ($deal['net_price'] ?? $order->agreed_price), 2) }}</td>
            </tr>
        </table>
    </div>

    <div class="declaration">
        This booking confirmation does not constitute final ownership or transfer until all
        contractual conditions and dues are cleared. Inventory remains reserved against the applicant while
        this booking remains open.
    </div>

    <table class="signatures">
        <tr>
            <td>
                <div class="sig-line">Applicant / buyer</div>
            </td>
            <td class="gap"></td>
            <td>
                <div class="sig-line">For {{ $displayName }}</div>
            </td>
        </tr>
    </table>

    <p class="footer-note">
        Computer-generated booking confirmation letter · {{ $displayName }}
        @if (filled($order->booking_number))
            · {{ $order->booking_number }}
        @elseif (filled($order->code))
            · {{ $order->code }}
        @endif
    </p>
</body>
</html>
