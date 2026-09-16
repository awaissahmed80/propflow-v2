<?php

namespace App\Http\Requests\Portal;

use App\Models\AssetFolder;
use App\Support\AssetManager;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateAssetFolderRequest extends FormRequest
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
        /** @var AssetFolder $folder */
        $folder = $this->route('folder');

        return [
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'parent_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists(AssetFolder::class, 'id')->where(
                    fn ($query) => $query
                        ->where('kind', AssetManager::KIND_DOCUMENT)
                        ->where('id', '!=', $folder->id)
                ),
            ],
            'order' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->exists('parent_id')) {
                return;
            }

            $parentId = $this->input('parent_id');

            if ($parentId === null || $parentId === '') {
                return;
            }

            $parent = AssetFolder::query()->find((int) $parentId);

            if ($parent === null) {
                return;
            }

            if (! $parent->canHaveChildren()) {
                $validator->errors()->add(
                    'parent_id',
                    'Folders can only be nested two levels deep.',
                );
            }

            /** @var AssetFolder $folder */
            $folder = $this->route('folder');

            if ($folder->children()->exists() && $parent->parent_id !== null) {
                $validator->errors()->add(
                    'parent_id',
                    'A folder with subfolders cannot be moved under another folder.',
                );
            }
        });
    }
}
