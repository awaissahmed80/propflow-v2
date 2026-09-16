<?php

namespace App\Http\Requests\Portal;

use App\Models\AssetLabel;
use App\Support\AssetManager;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SyncAssetLabelsRequest extends FormRequest
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
            'label_ids' => ['present', 'array'],
            'label_ids.*' => [
                'integer',
                'distinct',
                Rule::exists(AssetLabel::class, 'id')->where(
                    fn ($query) => $query->where('kind', AssetManager::KIND_DOCUMENT)
                ),
            ],
        ];
    }
}
