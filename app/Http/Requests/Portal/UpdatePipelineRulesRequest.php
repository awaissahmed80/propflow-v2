<?php

namespace App\Http\Requests\Portal;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePipelineRulesRequest extends FormRequest
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
            'auto_assign' => ['required', 'boolean'],
            'require_notes_on_stage_change' => ['required', 'boolean'],
            'flag_stale_leads' => ['required', 'boolean'],
            'stale_after_days' => ['required', 'integer', 'min:1', 'max:365'],
        ];
    }
}
