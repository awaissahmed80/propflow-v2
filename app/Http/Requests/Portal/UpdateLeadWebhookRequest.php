<?php

namespace App\Http\Requests\Portal;

use App\Enums\TenantMembershipStatus;
use App\Models\Campaign;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateLeadWebhookRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'default_source' => $this->filled('default_source') ? $this->input('default_source') : null,
            'default_campaign_id' => $this->filled('default_campaign_id') ? $this->input('default_campaign_id') : null,
            'default_lead_stage_id' => $this->filled('default_lead_stage_id') ? $this->input('default_lead_stage_id') : null,
            'default_assignee_id' => $this->filled('default_assignee_id') ? $this->input('default_assignee_id') : null,
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
            'default_source' => ['nullable', 'string', 'max:150'],
            'default_campaign_id' => [
                'nullable',
                'integer',
                Rule::exists(Campaign::class, 'id')->where('status', Campaign::STATUS_ACTIVE),
            ],
            'default_lead_stage_id' => [
                'nullable',
                'integer',
                Rule::exists(LeadStage::class, 'id'),
            ],
            'default_assignee_id' => ['nullable', 'integer'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $assigneeId = $this->input('default_assignee_id');

                if (blank($assigneeId) || $validator->errors()->isNotEmpty()) {
                    return;
                }

                $tenant = Tenant::current();
                $member = $tenant && TenantUser::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('user_id', $assigneeId)
                    ->where('status', TenantMembershipStatus::Active)
                    ->exists();

                if (! $member) {
                    $validator->errors()->add('default_assignee_id', 'Choose a member of this workspace.');
                }
            },
        ];
    }
}
