<?php

namespace App\Http\Requests\Portal;

use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\Unit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateUnitRequest extends FormRequest
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
            'project_id' => ['sometimes', 'required', 'integer', Rule::exists(Project::class, 'id')],
            'project_block_id' => ['sometimes', 'nullable', 'integer', Rule::exists(ProjectBlock::class, 'id')],
            'name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'type' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sector' => ['sometimes', 'nullable', 'string', 'max:100'],
            'price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'size' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'area_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'quantity' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'status' => ['sometimes', 'nullable', 'string', Rule::in(Unit::statuses())],
            'features' => ['sometimes', 'nullable', 'array'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var Unit $unit */
            $unit = $this->route('unit');

            $projectId = $this->input('project_id', $unit->project_id);
            $blockId = $this->exists('project_block_id')
                ? $this->input('project_block_id')
                : $unit->project_block_id;

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
