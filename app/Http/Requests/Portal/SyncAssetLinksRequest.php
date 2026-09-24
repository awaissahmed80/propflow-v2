<?php

namespace App\Http\Requests\Portal;

use App\Support\AssetManager;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SyncAssetLinksRequest extends FormRequest
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
            'assetable_type' => ['required', 'string', Rule::in(array_keys(AssetManager::ASSETABLES))],
            'assetable_id' => ['required', 'integer', 'min:1'],
            'linkage' => [
                'required',
                'string',
                Rule::in([
                    AssetManager::LINKAGE_AVATAR,
                    AssetManager::LINKAGE_THUMBNAIL,
                    AssetManager::LINKAGE_GALLERY,
                    AssetManager::LINKAGE_DOCUMENT,
                ]),
            ],
            'asset_ids' => ['present', 'array'],
            'asset_ids.*' => ['integer', 'distinct', 'min:1'],
            'label' => ['nullable', 'string', 'max:120'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'assetable_type' => is_string($this->assetable_type)
                ? mb_strtolower(trim($this->assetable_type))
                : $this->assetable_type,
            'linkage' => is_string($this->linkage)
                ? strtoupper(trim($this->linkage))
                : $this->linkage,
            'label' => is_string($this->label)
                ? trim($this->label)
                : $this->label,
        ]);
    }
}
