<?php

namespace App\Http\Requests\Portal;

use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\Integration;
use App\Models\LeadStage;
use App\Models\Project;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCampaignRequest extends FormRequest
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
        $metaConnected = Integration::query()
            ->where('provider', Integration::PROVIDER_META)
            ->where('status', Integration::STATUS_CONNECTED)
            ->exists();

        $whatsappConnected = Integration::query()
            ->where('provider', Integration::PROVIDER_WHATSAPP)
            ->where('status', Integration::STATUS_CONNECTED)
            ->exists();

        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'purpose' => ['nullable', 'string', Rule::in(Campaign::purposes())],
            'source_type' => [
                'nullable',
                'string',
                Rule::in(Campaign::sourceTypes()),
                function (string $attribute, mixed $value, \Closure $fail) use ($metaConnected, $whatsappConnected): void {
                    if ($value === Campaign::SOURCE_FACEBOOK && ! $metaConnected) {
                        $fail('Connect Meta in Settings → Integrations before creating a Meta campaign.');
                    }

                    if ($value === Campaign::SOURCE_WHATSAPP && ! $whatsappConnected) {
                        $fail('Connect WhatsApp in Settings → Integrations before creating a WhatsApp campaign.');
                    }
                },
            ],
            'source_config' => ['nullable', 'array'],
            'source_config.page_id' => [
                Rule::requiredIf(fn (): bool => $this->input('source_type') === Campaign::SOURCE_FACEBOOK),
                'nullable',
                'string',
                'max:100',
            ],
            'source_config.page_name' => ['nullable', 'string', 'max:255'],
            'source_config.form_id' => ['nullable', 'string', 'max:100'],
            'source_config.form_name' => ['nullable', 'string', 'max:255'],
            'source_config.phone_number_id' => [
                Rule::requiredIf(fn (): bool => $this->input('source_type') === Campaign::SOURCE_WHATSAPP),
                'nullable',
                'string',
                'max:100',
            ],
            'source_config.phone_number' => ['nullable', 'string', 'max:50'],
            'source_config.phone_name' => ['nullable', 'string', 'max:255'],
            'source_config.waba_id' => ['nullable', 'string', 'max:100'],
            'channel' => ['nullable', 'string', Rule::in(Campaign::channels())],
            'status' => ['nullable', 'string', Rule::in(Campaign::statuses())],
            'project_id' => ['nullable', 'integer', Rule::exists(Project::class, 'id')],
            'owner_id' => ['nullable', 'integer'],
            'default_assignee_id' => ['nullable', 'integer'],
            'default_lead_stage_id' => ['nullable', 'integer', Rule::exists(LeadStage::class, 'id')],
            'campaign_form_id' => ['nullable', 'integer', Rule::exists(CampaignForm::class, 'id')],
            'slug' => ['nullable', 'string', 'max:255'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'target_cpl' => ['nullable', 'numeric', 'min:0'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:50'],
            'utm' => ['nullable', 'array'],
            'utm.source' => ['nullable', 'string', 'max:100'],
            'utm.medium' => ['nullable', 'string', 'max:100'],
            'utm.campaign' => ['nullable', 'string', 'max:100'],
            'utm.content' => ['nullable', 'string', 'max:100'],
            'utm.term' => ['nullable', 'string', 'max:100'],
            'goals' => ['nullable', 'array'],
            'goals.*' => ['array'],
            'goals.*.enabled' => ['sometimes', 'boolean'],
            'goals.*.target' => ['nullable', 'integer', 'min:0'],
            'landing' => ['nullable', 'array'],
            'landing.headline' => ['nullable', 'string', 'max:255'],
            'landing.subheadline' => ['nullable', 'string', 'max:500'],
            'landing.body' => ['nullable', 'string', 'max:5000'],
            'landing.highlights' => ['nullable', 'array'],
            'landing.highlights.*' => ['nullable', 'string', 'max:255'],
            'landing.cta_label' => ['nullable', 'string', 'max:100'],
            'landing.thank_you_message' => ['nullable', 'string', 'max:1000'],
            'landing.redirect_url' => ['nullable', 'url', 'max:2000'],
            'landing.hero_image' => ['nullable', 'string', 'max:2000'],
            'lead_source_label' => ['nullable', 'string', 'max:100'],
            'create_form' => ['sometimes', 'boolean'],
            'form_name' => ['nullable', 'string', 'max:255'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'purpose' => $this->input('purpose') ?: Campaign::PURPOSE_LEAD_GENERATION,
            'source_type' => $this->input('source_type') ?: Campaign::SOURCE_CUSTOM_FORM,
            'status' => $this->input('status') ?: Campaign::STATUS_DRAFT,
            'channel' => $this->input('channel')
                ?: (in_array($this->input('source_type'), [Campaign::SOURCE_FACEBOOK, Campaign::SOURCE_WHATSAPP], true)
                    ? Campaign::CHANNEL_SOCIAL
                    : Campaign::CHANNEL_WEBSITE),
        ]);
    }
}
