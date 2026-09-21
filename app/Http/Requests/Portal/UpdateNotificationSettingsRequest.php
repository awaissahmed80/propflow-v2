<?php

namespace App\Http\Requests\Portal;

use App\Support\Notifications\NotificationSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateNotificationSettingsRequest extends FormRequest
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
        $rules = [];

        foreach (array_keys(NotificationSettings::defaults()) as $key) {
            $rules[$key] = ['required', 'boolean'];
        }

        return $rules;
    }
}
