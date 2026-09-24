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
    public const PAYMENT_ONE = 'one_payment';

    public const PAYMENT_INSTALLMENTS = 'installments';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $payload = [];

        if ($this->input('booking_kind') === Order::KIND_RESERVE) {
            $payload['token_amount'] = 0;
        }

        if ($this->input('token_amount') === '' || $this->input('token_amount') === null) {
            $payload['token_amount'] = 0;
        }

        $paymentMode = $this->input('payment_mode', self::PAYMENT_INSTALLMENTS);

        if ($paymentMode === self::PAYMENT_ONE) {
            $payload['installment_count'] = 1;
        } elseif ($this->input('installment_count') === '' || $this->input('installment_count') === null) {
            $payload['installment_count'] = 1;
        }

        if ($this->input('first_due_on') === '' || $this->input('first_due_on') === null) {
            $payload['first_due_on'] = now()->toDateString();
        }

        if ($payload !== []) {
            $this->merge($payload);
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
            'payment_mode' => ['nullable', 'string', Rule::in([self::PAYMENT_ONE, self::PAYMENT_INSTALLMENTS])],
            'installment_count' => ['nullable', 'integer', 'min:1', 'max:60'],
            'first_due_on' => ['nullable', 'date'],
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

                $token = (float) $this->input('token_amount', 0);
                $agreed = (float) $this->input('agreed_price');

                if ($token > $agreed) {
                    $validator->errors()->add('token_amount', 'The token amount cannot be more than the agreed price.');
                }
            },
        ];
    }
}
