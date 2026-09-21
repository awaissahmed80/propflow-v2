<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class OperationsController extends Controller
{
    /**
     * @var array<string, array{title: string, description: string, icon: string, breadcrumbs: list<array{label: string, href?: string}>}>
     */
    protected const SECTIONS = [
        'vouchers' => [
            'title' => 'Payment Vouchers',
            'description' => 'Log cash, pay orders, and cross-cheques, then issue serialized client receipts.',
            'icon' => 'coupon-3-line',
            'breadcrumbs' => [
                ['label' => 'Receivables'],
                ['label' => 'Payment Vouchers'],
            ],
        ],
        'verification' => [
            'title' => 'Verification Queue',
            'description' => 'Accounts desk to audit bank clearance before moving receipts from pending to approved.',
            'icon' => 'shield-check-line',
            'breadcrumbs' => [
                ['label' => 'Receivables'],
                ['label' => 'Verification Queue'],
            ],
        ],
        'statements' => [
            'title' => 'Statements of Account',
            'description' => 'Search and download client-facing ledgers of paid balances versus remaining liabilities.',
            'icon' => 'file-chart-line',
            'breadcrumbs' => [
                ['label' => 'Receivables'],
                ['label' => 'Statements of Account'],
            ],
        ],
        'agents' => [
            'title' => 'Agent Commissions',
            'description' => 'Track internal sales agent payouts mapped against cleared down payments.',
            'icon' => 'user-star-line',
            'breadcrumbs' => [
                ['label' => 'Commissions'],
                ['label' => 'Agent Commissions'],
            ],
        ],
        'dealers' => [
            'title' => 'Dealer / Broker Network',
            'description' => 'Manage affiliate payouts and commission distribution for third-party agencies.',
            'icon' => 'building-2-line',
            'breadcrumbs' => [
                ['label' => 'Commissions'],
                ['label' => 'Dealer / Broker Network'],
            ],
        ],
    ];

    public function overview(): Response
    {
        return Inertia::render('operations/overview', [
            'title' => 'Operations Overview',
            'breadcrumbs' => [
                ['label' => 'Operations'],
                ['label' => 'Overview'],
            ],
        ]);
    }

    public function comingSoon(?string $section = null): Response
    {
        $section = $section ?: 'vouchers';
        $meta = self::SECTIONS[$section] ?? [
            'title' => 'Coming Soon',
            'description' => 'This Operations workspace is scaffolded and ready for a follow-up build.',
            'icon' => 'tools-line',
            'breadcrumbs' => [['label' => 'Operations'], ['label' => 'Coming Soon']],
        ];

        return Inertia::render('operations/coming-soon', [
            'section' => $section,
            'title' => $meta['title'],
            'description' => $meta['description'],
            'icon' => $meta['icon'],
            'breadcrumbs' => $meta['breadcrumbs'],
        ]);
    }
}
