<?php

namespace App\Http\Requests\Portal;

use App\Models\Campaign;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateLeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'contact_id' => ['sometimes', 'nullable', 'integer', Rule::exists(Contact::class, 'id')],
            'contact' => ['nullable', 'array'],
            'contact.first_name' => ['nullable', 'string', 'max:150'],
            'contact.last_name' => ['nullable', 'string', 'max:150'],
            'contact.phone_number' => ['nullable', 'string', 'max:50'],
            'contact.email_address' => ['nullable', 'email', 'max:150'],
            'contact.reference' => ['nullable', 'string', 'max:255'],
            'project_id' => ['sometimes', 'nullable', 'integer', Rule::exists(Project::class, 'id')],
            'unit_id' => ['sometimes', 'nullable', 'integer', Rule::exists(Unit::class, 'id')],
            'assigned_to' => ['sometimes', 'nullable', 'integer', Rule::exists(User::class, 'id')],
            'lead_stage_id' => ['sometimes', 'nullable', 'integer', Rule::exists(LeadStage::class, 'id')],
            'campaign_id' => ['sometimes', 'nullable', 'integer', Rule::exists(Campaign::class, 'id')],
            'source' => ['sometimes', 'nullable', 'string', 'max:150'],
            'tag' => ['sometimes', 'nullable', 'string', Rule::in(Lead::tags())],
            'budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'next_action' => ['sometimes', 'nullable', 'string', 'max:150'],
            'due_date' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var Lead $lead */
            $lead = $this->route('lead');

            $projectId = $this->input('project_id', $lead->project_id);
            $unitId = $this->input('unit_id', $lead->unit_id);

            if ($projectId && $unitId) {
                $belongs = Unit::query()
                    ->whereKey($unitId)
                    ->where('project_id', $projectId)
                    ->exists();

                if (! $belongs) {
                    $validator->errors()->add(
                        'unit_id',
                        'The selected unit does not belong to this project.',
                    );
                }
            }

            if (! $this->filled('assigned_to')) {
                return;
            }

            $tenant = Tenant::current();

            if (! $tenant) {
                return;
            }

            $isMember = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $this->input('assigned_to'))
                ->exists();

            if (! $isMember) {
                $validator->errors()->add(
                    'assigned_to',
                    'The selected assignee is not a member of this workspace.',
                );
            }
        });
    }
}
