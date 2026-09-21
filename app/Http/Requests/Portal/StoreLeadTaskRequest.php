<?php

namespace App\Http\Requests\Portal;

use App\Models\Asset;
use App\Models\Lead;
use App\Models\LeadActionType;
use App\Models\Task;
use App\Support\AssetManager;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreLeadTaskRequest extends FormRequest
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
            'comments' => ['required', 'string', 'max:5000'],
            'next_action' => ['required', 'string', Rule::in(Lead::nextActions())],
            'due_date' => [
                'nullable',
                'date',
                Rule::requiredIf(fn (): bool => ! LeadActionType::isDoNothing($this->input('next_action'))),
            ],
            'media_ids' => ['sometimes', 'array', 'max:20'],
            'media_ids.*' => ['integer', 'distinct', 'min:1'],
            'document_ids' => ['sometimes', 'array', 'max:20'],
            'document_ids.*' => ['integer', 'distinct', 'min:1'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $this->assertLibraryIds($validator, 'media_ids', AssetManager::KIND_MEDIA);
            $this->assertLibraryIds($validator, 'document_ids', AssetManager::KIND_DOCUMENT);
        });
    }

    private function assertLibraryIds(Validator $validator, string $field, string $kind): void
    {
        if ($validator->errors()->has($field)) {
            return;
        }

        $ids = $this->input($field, []);

        if (! is_array($ids) || $ids === []) {
            return;
        }

        $ids = collect($ids)
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values();

        $found = Asset::query()
            ->where('tag', $kind)
            ->whereIn('id', $ids)
            ->count();

        if ($found !== $ids->count()) {
            $validator->errors()->add($field, 'One or more selected files are not available.');
        }
    }
}
