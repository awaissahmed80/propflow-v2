<?php

namespace App\Http\Requests\Portal;

use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\LeadStage;
use App\Models\Project;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCampaignRequest extends FormRequest
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
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'purpose' => ['sometimes', 'string', Rule::in(Campaign::purposes())],
            'source_type' => ['sometimes', 'string', Rule::in(Campaign::sourceTypes())],
            'source_config' => ['sometimes', 'nullable', 'array'],
            'source_config.page_id' => ['nullable', 'string', 'max:100'],
            'source_config.page_name' => ['nullable', 'string', 'max:255'],
            'source_config.form_id' => ['nullable', 'string', 'max:100'],
            'source_config.form_name' => ['nullable', 'string', 'max:255'],
            'source_config.phone_number_id' => ['nullable', 'string', 'max:100'],
            'source_config.phone_number' => ['nullable', 'string', 'max:50'],
            'source_config.phone_name' => ['nullable', 'string', 'max:255'],
            'source_config.waba_id' => ['nullable', 'string', 'max:100'],
            'channel' => ['sometimes', 'nullable', 'string', Rule::in(Campaign::channels())],
            'status' => ['sometimes', 'string', Rule::in(Campaign::statuses())],
            'project_id' => ['sometimes', 'nullable', 'integer', Rule::exists(Project::class, 'id')],
            'owner_id' => ['sometimes', 'nullable', 'integer'],
            'default_assignee_id' => ['sometimes', 'nullable', 'integer'],
            'default_lead_stage_id' => ['sometimes', 'nullable', 'integer', Rule::exists(LeadStage::class, 'id')],
            'campaign_form_id' => ['sometimes', 'nullable', 'integer', Rule::exists(CampaignForm::class, 'id')],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'starts_at' => ['sometimes', 'nullable', 'date'],
            'ends_at' => ['sometimes', 'nullable', 'date'],
            'budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'target_cpl' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'tags' => ['sometimes', 'nullable', 'array'],
            'tags.*' => ['string', 'max:50'],
            'utm' => ['sometimes', 'nullable', 'array'],
            'goals' => ['sometimes', 'nullable', 'array'],
            'goals.*' => ['array'],
            'goals.*.enabled' => ['sometimes', 'boolean'],
            'goals.*.target' => ['nullable', 'integer', 'min:0'],
            'landing' => ['sometimes', 'nullable', 'array'],
            'landing.headline' => ['nullable', 'string', 'max:255'],
            'landing.subheadline' => ['nullable', 'string', 'max:500'],
            'landing.body' => ['nullable', 'string', 'max:5000'],
            'landing.highlights' => ['nullable', 'array'],
            'landing.highlights.*' => ['nullable', 'string', 'max:255'],
            'landing.cta_label' => ['nullable', 'string', 'max:100'],
            'landing.thank_you_message' => ['nullable', 'string', 'max:1000'],
            'landing.redirect_url' => ['nullable', 'url', 'max:2000'],
            'landing.hero_image' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
