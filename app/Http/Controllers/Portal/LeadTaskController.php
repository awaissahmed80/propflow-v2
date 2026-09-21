<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreLeadTaskRequest;
use App\Models\Lead;
use App\Services\LeadActivity;
use Illuminate\Http\RedirectResponse;

class LeadTaskController extends Controller
{
    public function __construct(protected LeadActivity $activity) {}

    public function store(StoreLeadTaskRequest $request, Lead $lead): RedirectResponse
    {
        if ($lead->hasActiveDeal()) {
            return back()->withErrors([
                'lead' => 'This lead is locked while its booking is active. Cancel the booking to add tasks.',
            ]);
        }

        $this->activity->recordUpdate(
            $lead,
            $request->validated(),
            $request->user()?->id,
        );

        return back();
    }
}
