<?php

namespace Tests\Feature\Portal;

use App\Models\PaymentAccount;
use App\Models\Setting;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class PaymentAccountSettingsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.base_domain' => 'propflow.test',
            'app.url_scheme' => 'https',
        ]);

        $this->migrateLandlord();
        $this->migrateTenant();
    }

    public function test_bank_cash_settings_section_seeds_defaults(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_payment_accounts_index');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bank-cash'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'bank-cash')
                ->has('paymentAccounts', 2)
            );

        $tenant->makeCurrent();
        $this->assertTrue(PaymentAccount::query()->where('type', PaymentAccount::TYPE_BANK)->where('is_default', true)->exists());
        $this->assertTrue(PaymentAccount::query()->where('type', PaymentAccount::TYPE_CASH)->where('is_default', true)->exists());
        Tenant::forgetCurrent();
    }

    public function test_payment_account_can_be_created_and_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_payment_accounts_store');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bank-cash'))->assertOk();

        $this->post(Domain::portal('/settings/payment-accounts'), [
            'type' => PaymentAccount::TYPE_BANK,
            'name' => 'HBL Corporate',
            'bank_name' => 'HBL',
            'account_title' => 'Propflow Demo',
            'account_number' => '1234567890',
            'is_default' => true,
            'is_enabled' => true,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $account = PaymentAccount::query()->where('name', 'HBL Corporate')->first();
        $this->assertNotNull($account);
        $this->assertTrue($account->is_default);
        Tenant::forgetCurrent();

        $this->put(Domain::portal('/settings/payment-accounts/'.$account->id), [
            'name' => 'HBL Main',
            'bank_name' => 'HBL',
            'account_title' => 'Propflow Demo',
            'account_number' => '1234567890',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame('HBL Main', $account->fresh()->name);
        Tenant::forgetCurrent();
    }

    public function test_cannot_delete_last_account_of_a_type(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_payment_accounts_delete');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bank-cash'))->assertOk();

        $tenant->makeCurrent();
        $bank = PaymentAccount::query()->where('type', PaymentAccount::TYPE_BANK)->firstOrFail();
        Tenant::forgetCurrent();

        $this->from(Domain::portal('/settings/bank-cash'))
            ->delete(Domain::portal('/settings/payment-accounts/'.$bank->id))
            ->assertRedirect(Domain::portal('/settings/bank-cash'))
            ->assertSessionHasErrors('account');

        $tenant->makeCurrent();
        $this->assertNotNull(PaymentAccount::query()->find($bank->id));
        Tenant::forgetCurrent();
    }

    public function test_general_settings_no_longer_accept_bank_fields(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_payment_accounts_general');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/general'), [
            'business_name' => 'Demo Co',
            'legal_name' => 'Demo Co LLC',
            'bank_name' => 'Should Not Persist',
            'account_number' => '999',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $general = Setting::group(Setting::GROUP_GENERAL, []);
        $this->assertArrayNotHasKey('bank_name', $general);
        $this->assertArrayNotHasKey('account_number', $general);
        $this->assertSame('Demo Co LLC', $general['legal_name'] ?? null);
        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantUser(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        return [$user, $tenant];
    }
}
