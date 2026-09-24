<?php

namespace App\Http\Requests\Portal;

use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SyncLeadSharesRequest extends FormRequest
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
            'user_ids' => ['present', 'array'],
            'user_ids.*' => ['integer', Rule::exists(User::class, 'id')],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $tenant = Tenant::current();

            if (! $tenant) {
                return;
            }

            /** @var list<int|string> $userIds */
            $userIds = $this->input('user_ids', []);

            if ($userIds === []) {
                return;
            }

            $memberIds = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->whereIn('user_id', $userIds)
                ->pluck('user_id')
                ->map(fn ($id): int => (int) $id)
                ->all();

            $memberLookup = array_flip($memberIds);

            foreach ($userIds as $index => $userId) {
                if (! isset($memberLookup[(int) $userId])) {
                    $validator->errors()->add(
                        "user_ids.{$index}",
                        'The selected user is not a member of this workspace.',
                    );
                }
            }
        });
    }
}
