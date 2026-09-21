<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StorePaymentPlanTemplateRequest;
use App\Http\Requests\Portal\UpdatePaymentPlanTemplateRequest;
use App\Models\PaymentPlanTemplate;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentPlanTemplateController extends Controller
{
    public function index(Request $request): Response
    {
        PaymentPlanTemplate::ensureDefaults();

        $query = $request->string('q')->trim()->toString();

        $templates = PaymentPlanTemplate::query()
            ->with(['project:id,title,code'])
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($inner) use ($query): void {
                    $inner->where('title', 'like', "%{$query}%")
                        ->orWhereHas('project', fn ($project) => $project->where('title', 'like', "%{$query}%"));
                });
            })
            ->orderByDesc('is_system')
            ->orderBy('title')
            ->get()
            ->map(fn (PaymentPlanTemplate $template): array => $this->serialize($template))
            ->values()
            ->all();

        return Inertia::render('plan-templates/index', [
            'templates' => $templates,
            'filters' => ['q' => $query],
            'formOptions' => [
                'projects' => Project::query()
                    ->orderBy('title')
                    ->get(['id', 'title', 'code'])
                    ->map(fn (Project $project): array => [
                        'id' => $project->id,
                        'title' => $project->title,
                        'code' => $project->code,
                    ])
                    ->values()
                    ->all(),
                'frequencies' => [
                    ['value' => 'monthly', 'label' => 'Monthly'],
                    ['value' => 'quarterly', 'label' => 'Quarterly'],
                ],
                'late_fee_bases' => [
                    ['value' => 'daily', 'label' => 'Daily'],
                    ['value' => 'monthly', 'label' => 'Monthly'],
                ],
            ],
        ]);
    }

    public function store(StorePaymentPlanTemplateRequest $request): RedirectResponse
    {
        PaymentPlanTemplate::query()->create($request->validated());

        return back();
    }

    public function update(UpdatePaymentPlanTemplateRequest $request, PaymentPlanTemplate $template): RedirectResponse
    {
        $template->update($request->validated());

        return back();
    }

    public function destroy(PaymentPlanTemplate $template): RedirectResponse
    {
        if ($template->is_system) {
            return back()->withErrors([
                'template' => 'System plan templates cannot be deleted. Disable them instead.',
            ]);
        }

        $template->delete();

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    protected function serialize(PaymentPlanTemplate $template): array
    {
        return [
            'id' => $template->id,
            'title' => $template->title,
            'project_id' => $template->project_id,
            'project' => $template->project ? [
                'id' => $template->project->id,
                'title' => $template->project->title,
                'code' => $template->project->code,
            ] : null,
            'frequency' => $template->frequency,
            'installment_count' => (int) $template->installment_count,
            'balloon_every' => $template->balloon_every !== null ? (int) $template->balloon_every : null,
            'down_payment_percent' => (float) $template->down_payment_percent,
            'handover_percent' => (float) $template->handover_percent,
            'late_fee_basis' => $template->late_fee_basis,
            'late_fee_rate' => $template->late_fee_rate !== null ? (float) $template->late_fee_rate : null,
            'is_system' => (bool) $template->is_system,
            'is_enabled' => (bool) $template->is_enabled,
        ];
    }
}
