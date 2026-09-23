<?php

namespace App\Http\Requests\Portal;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StorePersonalReminderRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:200'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'due_at' => ['nullable', 'date'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('due_at')) {
            return;
        }

        $dueAt = str_replace(' ', 'T', (string) $this->input('due_at'));

        if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $dueAt) === 1) {
            $this->merge(['due_at' => $dueAt.':00']);
        }
    }
}
