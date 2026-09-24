<?php

namespace App\Http\Requests\Portal;

use App\Models\Order;
use App\Models\PaymentAccount;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class VerifyTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if ($user === null) {
            return false;
        }

        if ($user->can('verify booking') || $user->can('manage booking')) {
            return true;
        }

        $tenant = Tenant::current();

        if ($tenant === null) {
            return false;
        }

        return $user->memberships()
            ->where('tenant_id', $tenant->id)
            ->where('is_owner', true)
            ->exists();
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('identity_number') && $this->filled('cnic')) {
            $this->merge([
                'identity_number' => $this->input('cnic'),
                'identity_kind' => $this->input('identity_kind', 'cnic'),
            ]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'contact_name' => ['required', 'string', 'max:150'],
            'phone_number' => ['required', 'string', 'max:50'],
            'email_address' => ['nullable', 'email', 'max:150'],
            'identity_kind' => ['nullable', 'string', Rule::in(['cnic', 'nicop', 'passport'])],
            'identity_number' => ['nullable', 'string', 'max:50'],
            'cnic' => ['nullable', 'string', 'max:50'],
            'project_id' => ['required', 'integer', Rule::exists(Project::class, 'id')],
            'unit_id' => ['required', 'integer', Rule::exists(Unit::class, 'id')],
            'payment_account_id' => [
                'required',
                'integer',
                Rule::exists(PaymentAccount::class, 'id')->where(fn ($query) => $query->where('is_enabled', true)),
            ],
            'agreed_price' => ['required', 'numeric', 'min:0'],
            'token_amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['required', 'string', 'max:80'],
            'reference' => ['nullable', 'string', 'max:80'],
            'paid_on' => ['required', 'date'],
            'receipt' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $token = (float) $this->input('token_amount', 0);
                $agreed = (float) $this->input('agreed_price', 0);

                if ($token > $agreed) {
                    $validator->errors()->add('token_amount', 'The token amount cannot be more than the agreed price.');
                }

                $unitId = (int) $this->input('unit_id');
                $projectId = (int) $this->input('project_id');

                if ($unitId <= 0 || $projectId <= 0) {
                    return;
                }

                $unit = Unit::query()->find($unitId);

                if ($unit === null) {
                    return;
                }

                if ((int) $unit->project_id !== $projectId) {
                    $validator->errors()->add('unit_id', 'Choose a unit that belongs to the selected project.');

                    return;
                }

                /** @var Order|null $order */
                $order = $this->route('order');
                $currentUnitId = $order instanceof Order ? (int) $order->unit_id : 0;

                if ($unitId !== $currentUnitId && ! $unit->isBookable()) {
                    $validator->errors()->add('unit_id', 'Choose a unit that is available or on hold.');
                }
            },
        ];
    }
}
