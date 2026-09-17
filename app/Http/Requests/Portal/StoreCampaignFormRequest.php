<?php

namespace App\Http\Requests\Portal;

use App\Models\CampaignForm;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCampaignFormRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'status' => ['nullable', 'string', Rule::in(CampaignForm::statuses())],
            'fields' => ['nullable', 'array'],
            'settings' => ['nullable', 'array'],
            'settings.lead_stage_id' => ['nullable', 'integer', Rule::exists(LeadStage::class, 'id')],
            'settings.assigned_to' => ['nullable', 'integer', Rule::exists(User::class, 'id')],
            'settings.project_id' => ['nullable', 'integer', Rule::exists(Project::class, 'id')],
            'settings.source' => ['nullable', 'string', 'max:150'],
            'settings.thank_you_message' => ['nullable', 'string', 'max:1000'],
            'settings.redirect_url' => ['nullable', 'url', 'max:2000'],
            'branding' => ['nullable', 'array'],
            'branding.button_label' => ['nullable', 'string', 'max:100'],
        ];
    }
}
