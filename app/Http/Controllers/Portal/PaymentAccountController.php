<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StorePaymentAccountRequest;
use App\Http\Requests\Portal\UpdatePaymentAccountRequest;
use App\Models\PaymentAccount;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class PaymentAccountController extends Controller
{
    public function store(StorePaymentAccountRequest $request): RedirectResponse
    {
        $data = $request->validated();

        DB::connection('tenant')->transaction(function () use ($data): void {
            $account = PaymentAccount::query()->create([
                ...$data,
                'is_default' => (bool) ($data['is_default'] ?? false),
                'is_enabled' => array_key_exists('is_enabled', $data) ? (bool) $data['is_enabled'] : true,
            ]);

            if ($account->is_default) {
                $account->makeDefault();
            } elseif (! PaymentAccount::query()->where('type', $account->type)->where('is_default', true)->exists()) {
                $account->makeDefault();
            }
        });

        return back();
    }

    public function update(UpdatePaymentAccountRequest $request, PaymentAccount $paymentAccount): RedirectResponse
    {
        $data = $request->validated();

        DB::connection('tenant')->transaction(function () use ($paymentAccount, $data): void {
            $paymentAccount->forceFill([
                'name' => $data['name'] ?? $paymentAccount->name,
                'bank_name' => array_key_exists('bank_name', $data) ? $data['bank_name'] : $paymentAccount->bank_name,
                'account_title' => array_key_exists('account_title', $data) ? $data['account_title'] : $paymentAccount->account_title,
                'account_number' => array_key_exists('account_number', $data) ? $data['account_number'] : $paymentAccount->account_number,
                'iban' => array_key_exists('iban', $data) ? $data['iban'] : $paymentAccount->iban,
                'swift' => array_key_exists('swift', $data) ? $data['swift'] : $paymentAccount->swift,
                'branch' => array_key_exists('branch', $data) ? $data['branch'] : $paymentAccount->branch,
                'is_enabled' => array_key_exists('is_enabled', $data)
                    ? (bool) $data['is_enabled']
                    : $paymentAccount->is_enabled,
            ])->save();

            if (! empty($data['is_default'])) {
                $paymentAccount->makeDefault();
            }
        });

        return back();
    }

    public function destroy(PaymentAccount $paymentAccount): RedirectResponse
    {
        $sameTypeCount = PaymentAccount::query()
            ->where('type', $paymentAccount->type)
            ->count();

        if ($sameTypeCount <= 1) {
            return back()->withErrors([
                'account' => 'At least one '.$paymentAccount->type.' account is required.',
            ]);
        }

        DB::connection('tenant')->transaction(function () use ($paymentAccount): void {
            $wasDefault = $paymentAccount->is_default;
            $type = $paymentAccount->type;
            $paymentAccount->delete();

            if ($wasDefault) {
                $next = PaymentAccount::query()
                    ->where('type', $type)
                    ->orderBy('id')
                    ->first();

                $next?->makeDefault();
            }
        });

        return back();
    }
}
