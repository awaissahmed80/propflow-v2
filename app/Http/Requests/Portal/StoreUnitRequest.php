<?php

namespace App\Http\Requests\Portal;

use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\Unit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreUnitRequest extends FormRequest
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
            'project_id' => ['required', 'integer', Rule::exists(Project::class, 'id')],
            'project_block_id' => ['nullable', 'integer', Rule::exists(ProjectBlock::class, 'id')],
            'name' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'type' => ['nullable', 'string', 'max:100'],
            'sector' => ['nullable', 'string', 'max:100'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'size' => ['nullable', 'numeric', 'min:0'],
            'area_type' => ['nullable', 'string', 'max:50'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'string', Rule::in(Unit::statuses())],
            'features' => ['nullable', 'array'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $projectId = $this->input('project_id');
            $blockId = $this->input('project_block_id');

            if (! $projectId || ! $blockId) {
                return;
            }

            $belongs = ProjectBlock::query()
                ->whereKey($blockId)
                ->where('project_id', $projectId)
                ->exists();

            if (! $belongs) {
                $validator->errors()->add(
                    'project_block_id',
                    'The selected block does not belong to this project.',
                );
            }
        });
    }
}
