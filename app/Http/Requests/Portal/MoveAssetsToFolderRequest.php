<?php

namespace App\Http\Requests\Portal;

use App\Models\Asset;
use App\Models\AssetFolder;
use App\Support\AssetManager;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MoveAssetsToFolderRequest extends FormRequest
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
            'asset_ids' => ['required', 'array', 'min:1'],
            'asset_ids.*' => [
                'integer',
                'distinct',
                Rule::exists(Asset::class, 'id')->where(
                    fn ($query) => $query->where('tag', AssetManager::KIND_DOCUMENT)
                ),
            ],
            'folder_id' => [
                'nullable',
                'integer',
                Rule::exists(AssetFolder::class, 'id')->where(
                    fn ($query) => $query->where('kind', AssetManager::KIND_DOCUMENT)
                ),
            ],
        ];
    }
}
