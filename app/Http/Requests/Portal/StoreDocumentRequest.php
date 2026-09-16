<?php

namespace App\Http\Requests\Portal;

use App\Models\AssetFolder;
use App\Models\AssetLabel;
use App\Support\AssetManager;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDocumentRequest extends FormRequest
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
            'file' => [
                'required',
                'file',
                'max:10240',
                'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,rar,jpg,jpeg,png,webp',
            ],
            'folder_id' => [
                'nullable',
                'integer',
                Rule::exists(AssetFolder::class, 'id')->where(
                    fn ($query) => $query->where('kind', AssetManager::KIND_DOCUMENT)
                ),
            ],
            'label_ids' => ['nullable', 'array'],
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
