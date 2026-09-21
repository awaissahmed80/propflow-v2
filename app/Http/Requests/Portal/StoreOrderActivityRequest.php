<?php

namespace App\Http\Requests\Portal;

use App\Models\Task;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrderActivityRequest extends FormRequest
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
            'action' => ['required', 'string', Rule::in(Task::activityTypes())],
            'comments' => ['required', 'string', 'max:2000'],
            'media_ids' => ['nullable', 'array'],
            'media_ids.*' => ['integer'],
            'document_ids' => ['nullable', 'array'],
            'document_ids.*' => ['integer'],
        ];
    }
}
