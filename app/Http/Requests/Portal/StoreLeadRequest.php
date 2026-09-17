<?php

namespace App\Http\Requests\Portal;

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

class StoreLeadRequest extends FormRequest
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
            'contact_id' => ['nullable', 'integer', Rule::exists(Contact::class, 'id')],
            'contact' => ['nullable', 'array'],
            'contact.first_name' => [
                Rule::requiredIf(fn (): bool => blank($this->input('contact_id'))),
                'nullable',
                'string',
                'max:150',
            ],
            'contact.last_name' => ['nullable', 'string', 'max:150'],
            'contact.phone_number' => [
                'nullable',
                'string',
                'max:50',
                Rule::requiredIf(function (): bool {
                    return blank($this->input('contact_id'))
                        && blank($this->input('contact.email_address'));
                }),
            ],
            'contact.email_address' => [
                'nullable',
                'email',
                'max:150',
                Rule::requiredIf(function (): bool {
                    return blank($this->input('contact_id'))
                        && blank($this->input('contact.phone_number'));
                }),
            ],
            'contact.reference' => ['nullable', 'string', 'max:255'],
            'project_id' => ['nullable', 'integer', Rule::exists(Project::class, 'id')],
            'unit_id' => ['nullable', 'integer', Rule::exists(Unit::class, 'id')],
            'assigned_to' => ['nullable', 'integer', Rule::exists(User::class, 'id')],
            'lead_stage_id' => ['nullable', 'integer', Rule::exists(LeadStage::class, 'id')],
            'source' => ['nullable', 'string', 'max:150'],
            'tag' => ['nullable', 'string', Rule::in(Lead::tags())],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'next_action' => ['nullable', 'string', 'max:150'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $projectId = $this->input('project_id');
            $unitId = $this->input('unit_id');

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

            $assignedTo = $this->input('assigned_to');
            $tenant = Tenant::current();

            if ($assignedTo && $tenant) {
                $isMember = TenantUser::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('user_id', $assignedTo)
                    ->exists();

                if (! $isMember) {
                    $validator->errors()->add(
                        'assigned_to',
                        'The selected assignee is not a member of this workspace.',
                    );
                }
            }
        });
    }
}
