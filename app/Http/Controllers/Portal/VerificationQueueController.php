<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Support\AssetManager;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class VerificationQueueController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(Request $request): Response
    {
        $mine = $request->boolean('mine');
        $userId = (int) $request->user()->id;

        $query = Order::query()
            ->with([
                'contact:id,first_name,last_name,phone_number',
                'project:id,title',
                'assignee:id,display_name,first_name,last_name',
                'documents.asset',
            ])
            ->where('stage', Order::STAGE_TOKEN)
            ->where('status', '!=', Order::STATUS_CANCELLED)
            ->when($mine, fn ($builder) => $builder->where('assigned_to', $userId))
            ->orderBy('booked_at')
            ->orderBy('id');

        $paginator = $query->paginate(20)->withQueryString();

        return Inertia::render('receivables/verification', [
            'title' => 'Verification Queue',
            'description' => 'Token bookings awaiting formal verification. Sales agents monitor and chase clients; Operations clears funds.',
            'breadcrumbs' => [
                ['label' => 'Sales'],
                ['label' => 'Receivables'],
                ['label' => 'Verification Queue'],
            ],
            'filters' => [
                'mine' => $mine,
            ],
            'bookings' => $paginator->getCollection()->map(function (Order $order): array {
                $contactName = trim(implode(' ', array_filter([
                    $order->contact?->first_name,
                    $order->contact?->last_name,
                ])));
                $docs = $order->documents
                    ->map(fn ($link): ?array => $link->asset ? [
                        'id' => $link->asset->id,
                        'name' => $link->asset->name,
                        'url' => $this->assets->url($link->asset),
                    ] : null)
                    ->filter()
                    ->values()
                    ->all();

                return [
                    'id' => $order->id,
                    'code' => $order->code,
                    'buyer' => $contactName !== '' ? $contactName : 'Buyer',
                    'phone' => $order->contact?->phone_number,
                    'project' => $order->project?->title,
                    'assignee' => $order->assignee?->display_name
                        ?: trim(($order->assignee?->first_name ?? '').' '.($order->assignee?->last_name ?? '')),
                    'assigned_to' => $order->assigned_to,
                    'booked_at' => $order->booked_at?->toIso8601String(),
                    'docs_count' => count($docs),
                    'docs_ready' => count($docs) > 0,
                    'href' => '/bookings?booking='.$order->code,
                ];
            })->values()->all(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }
}
