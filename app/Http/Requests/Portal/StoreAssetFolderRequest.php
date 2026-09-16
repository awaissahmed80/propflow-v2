<?php

namespace App\Http\Requests\Portal;

use App\Models\AssetFolder;
use App\Support\AssetManager;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreAssetFolderRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:100'],
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists(AssetFolder::class, 'id')->where(
                    fn ($query) => $query->where('kind', AssetManager::KIND_DOCUMENT)
                ),
            ],
            'order' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $parentId = $this->integer('parent_id') ?: null;

            if ($parentId === null) {
                return;
            }

            $parent = AssetFolder::query()->find($parentId);

            if ($parent === null) {
                return;
            }

            if (! $parent->canHaveChildren()) {
                $validator->errors()->add(
                    'parent_id',
                    'Folders can only be nested two levels deep.',
                );
            }
        });
    }
}
