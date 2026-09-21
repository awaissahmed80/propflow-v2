<?php

namespace App\Http\Requests\Portal;

use App\Models\Order;
use App\Models\Unit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ConvertLeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('booking_kind') === Order::KIND_RESERVE) {
            $this->merge(['token_amount' => 0]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'unit_id' => ['required', 'integer', Rule::exists(Unit::class, 'id')],
            'booking_kind' => ['required', 'string', Rule::in([Order::KIND_TOKEN, Order::KIND_RESERVE])],
            'agreed_price' => ['required', 'numeric', 'min:0'],
            'token_amount' => ['nullable', 'numeric', 'min:0'],
            'installment_count' => ['required', 'integer', 'min:1', 'max:60'],
            'first_due_on' => ['required', 'date'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->input('booking_kind') !== Order::KIND_TOKEN) {
                    return;
                }

                $token = (float) $this->input('token_amount');
                $agreed = (float) $this->input('agreed_price');

                if ($token <= 0) {
                    $validator->errors()->add('token_amount', 'Enter a token amount.');
                }

                if ($token > $agreed) {
                    $validator->errors()->add('token_amount', 'The token amount cannot be more than the agreed price.');
                }
            },
        ];
    }
}
