<?php

namespace App\Http\Requests\Public;

use App\Models\CampaignForm;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SubmitPublicFormRequest extends FormRequest
{
    public ?CampaignForm $campaignForm = null;

    public function authorize(): bool
    {
        $publicId = $this->route('form');

        if (! is_string($publicId) || $publicId === '') {
            return false;
        }

        $this->campaignForm = CampaignForm::query()
            ->where('public_id', $publicId)
            ->first();

        return $this->campaignForm !== null && $this->campaignForm->isActive();
    }

    protected function failedAuthorization(): void
    {
        abort(404);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['nullable', 'string', 'max:150'],
            'last_name' => ['nullable', 'string', 'max:150'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'email_address' => ['nullable', 'email', 'max:150'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'preferred_contact_time' => ['nullable', 'string', 'max:150'],
            'campaign_public_id' => ['nullable', 'uuid'],
            'channel' => ['nullable', 'string', 'in:embed,landing'],
            'page_url' => ['nullable', 'string', 'max:2000'],
            'referrer' => ['nullable', 'string', 'max:2000'],
            'utm' => ['nullable', 'array'],
            'utm.*' => ['nullable', 'string', 'max:255'],
            'company_website' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $form = $this->campaignForm;

            if (! $form) {
                return;
            }

            $honeypot = data_get($form->settings, 'honeypot_field', 'company_website');

            if (filled($this->input($honeypot))) {
                $validator->errors()->add('form', 'Unable to submit this form.');

                return;
            }

            foreach ($form->enabledFields() as $field) {
                $key = $field['key'] ?? null;

                if (! is_string($key) || $key === '') {
                    continue;
                }

                if (($field['required'] ?? false) && blank($this->input($key))) {
                    $validator->errors()->add($key, 'This field is required.');
                }
            }

            if (blank($this->input('phone_number')) && blank($this->input('email_address'))) {
                $validator->errors()->add(
                    'phone_number',
                    'A phone number or email address is required.',
                );
            }
        });
    }
}
