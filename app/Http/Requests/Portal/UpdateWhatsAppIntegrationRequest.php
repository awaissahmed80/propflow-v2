<?php

namespace App\Http\Requests\Portal;

use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Support\Integrations\WhatsApp\WhatsAppLeadSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWhatsAppIntegrationRequest extends FormRequest
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
        $tenant = Tenant::current();
        $userIds = [];

        if ($tenant) {
            $userIds = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->pluck('user_id')
                ->all();
        }

        return [
            'sync_frequency' => ['required', 'string', Rule::in(WhatsAppLeadSettings::syncFrequencies())],
            'default_owner' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) use ($userIds): void {
                    if ($value === WhatsAppLeadSettings::OWNER_ROUND_ROBIN) {
                        return;
                    }

                    if (! ctype_digit((string) $value) || ! in_array((int) $value, $userIds, true)) {
                        $fail('Select a valid lead owner.');
                    }
                },
            ],
            'default_lead_stage_id' => ['required', 'integer', Rule::exists(LeadStage::class, 'id')],
            'notify_on_new_leads' => ['required', 'boolean'],
            'deduplicate_by_phone' => ['required', 'boolean'],
            'auto_tag_source' => ['required', 'boolean'],
            'phone_number_id' => ['nullable', 'string', 'max:100'],
        ];
    }

    /**
     * @return array{
     *     sync_frequency: string,
     *     default_owner: string,
     *     default_lead_stage_id: int,
     *     notify_on_new_leads: bool,
     *     deduplicate_by_phone: bool,
     *     auto_tag_source: bool
     * }
     */
    public function leadSettings(): array
    {
        $validated = $this->validated();

        return [
            'sync_frequency' => $validated['sync_frequency'],
            'default_owner' => $validated['default_owner'],
            'default_lead_stage_id' => (int) $validated['default_lead_stage_id'],
            'notify_on_new_leads' => (bool) $validated['notify_on_new_leads'],
            'deduplicate_by_phone' => (bool) $validated['deduplicate_by_phone'],
            'auto_tag_source' => (bool) $validated['auto_tag_source'],
        ];
    }
}
