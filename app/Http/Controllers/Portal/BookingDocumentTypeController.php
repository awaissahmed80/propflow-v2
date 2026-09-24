<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\ReorderBookingDocumentTypesRequest;
use App\Http\Requests\Portal\StoreBookingDocumentTypeRequest;
use App\Http\Requests\Portal\UpdateBookingDocumentTypeRequest;
use App\Models\AssetLink;
use App\Models\BookingDocumentType;
use App\Models\Order;
use App\Support\AssetManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BookingDocumentTypeController extends Controller
{
    public function store(StoreBookingDocumentTypeRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $maxPriority = (int) BookingDocumentType::query()->max('priority');

        BookingDocumentType::query()->create([
            'label' => $validated['label'] ?? Str::slug($validated['title'], '_'),
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'is_required' => (bool) ($validated['is_required'] ?? true),
            'priority' => $maxPriority + 1,
        ]);

        return back();
    }

    public function update(UpdateBookingDocumentTypeRequest $request, BookingDocumentType $documentType): RedirectResponse
    {
        $validated = $request->validated();
        $previousLabel = $documentType->label;
        $nextLabel = $validated['label'] ?? $documentType->label;

        DB::connection('tenant')->transaction(function () use ($documentType, $validated, $previousLabel, $nextLabel): void {
            $documentType->forceFill([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'label' => $nextLabel,
                'is_required' => array_key_exists('is_required', $validated)
                    ? (bool) $validated['is_required']
                    : $documentType->is_required,
            ])->save();

            if (filled($previousLabel) && $previousLabel !== $nextLabel) {
                AssetLink::query()
                    ->where('assetable_type', Order::class)
                    ->where('linkage', AssetManager::LINKAGE_DOCUMENT)
                    ->where('label', $previousLabel)
                    ->update(['label' => $nextLabel]);
            }
        });

        return back();
    }

    public function reorder(ReorderBookingDocumentTypesRequest $request): RedirectResponse
    {
        $order = $request->validated('order');

        DB::connection('tenant')->transaction(function () use ($order): void {
            foreach ($order as $index => $documentTypeId) {
                BookingDocumentType::query()
                    ->whereKey($documentTypeId)
                    ->update(['priority' => $index + 1]);
            }
        });

        return back();
    }

    public function destroy(BookingDocumentType $documentType): RedirectResponse
    {
        if (BookingDocumentType::query()->count() <= 1) {
            return back()->withErrors([
                'document_type' => 'At least one required booking document is needed.',
            ]);
        }

        DB::connection('tenant')->transaction(function () use ($documentType): void {
            $documentType->delete();

            $remaining = BookingDocumentType::query()->orderBy('priority')->pluck('id');

            foreach ($remaining as $index => $id) {
                BookingDocumentType::query()->whereKey($id)->update(['priority' => $index + 1]);
            }
        });

        return back();
    }
}
