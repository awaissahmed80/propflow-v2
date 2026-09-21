<?php

namespace Tests\Feature\Portal;

use App\Models\MetaData;
use App\Models\Setting;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use App\Support\Notifications\NotificationSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class SettingsUpdateTest extends TestCase
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

    public function test_general_settings_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_general');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/settings/general'), [
            'business_name' => 'Harbor Homes',
            'tagline' => 'Homes that feel like harbor',
            'phone' => '+971501234567',
            'whatsapp' => '+971501234567',
            'email' => 'ops@harbor.test',
            'website' => 'https://harbor.test',
            'address' => 'Dubai Marina',
            'city' => 'Dubai',
            'state' => 'Dubai',
            'tax_id' => 'TRN-123456',
        ]);

        $response->assertRedirect();

        $tenant->makeCurrent();
        $data = Setting::group(Setting::GROUP_GENERAL);
        $this->assertSame('Harbor Homes', $data['business_name']);
        $this->assertSame('Homes that feel like harbor', $data['tagline']);
        $this->assertSame('+971501234567', $data['phone']);
        $this->assertSame('+971501234567', $data['whatsapp']);
        $this->assertSame('ops@harbor.test', $data['email']);
        $this->assertSame('https://harbor.test', $data['website']);
        $this->assertSame('Dubai Marina', $data['address']);
        $this->assertSame('Dubai', $data['city']);
        $this->assertSame('Dubai', $data['state']);
        $this->assertSame('TRN-123456', $data['tax_id']);
        $this->assertSame('Harbor Homes', $tenant->fresh()->name);
        Tenant::forgetCurrent();
    }

    public function test_general_settings_can_upload_logo(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_logo');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $file = UploadedFile::fake()->image('logo.png', 120, 120);

        $this->post(Domain::portal('/settings/general'), [
            'business_name' => 'Logo Co',
            'logo' => $file,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $data = Setting::group(Setting::GROUP_GENERAL);
        $this->assertNotEmpty($data['logo_path'] ?? null);
        $this->assertTrue(File::exists(public_path('assets/'.$data['logo_path'])));
        File::delete(public_path('assets/'.$data['logo_path']));
        Tenant::forgetCurrent();
    }

    public function test_configuration_settings_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_config');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/configuration'), [
            'currency_code' => 'pkr',
            'currency_symbol' => 'Rs',
            'country' => 'Pakistan',
            'timezone' => 'Asia/Karachi',
            'date_format' => 'DD/MM/YYYY',
            'time_format' => 'hh:mm A',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $data = Setting::group(Setting::GROUP_CONFIGURATION);
        $this->assertSame('PKR', $data['currency_code']);
        $this->assertSame('Rs', $data['currency_symbol']);
        $this->assertSame('Pakistan', $data['country']);
        $this->assertSame('Asia/Karachi', $data['timezone']);
        $this->assertSame('DD/MM/YYYY', $data['date_format']);
        $this->assertSame('hh:mm A', $data['time_format']);
        Tenant::forgetCurrent();
    }

    public function test_pipeline_rules_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_rules');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/pipeline-rules'), [
            'auto_assign' => true,
            'require_notes_on_stage_change' => true,
            'flag_stale_leads' => true,
            'stale_after_days' => 21,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $data = Setting::group(Setting::GROUP_PIPELINE_RULES);
        $this->assertTrue((bool) $data['auto_assign']);
        $this->assertTrue((bool) $data['require_notes_on_stage_change']);
        $this->assertTrue((bool) $data['flag_stale_leads']);
        $this->assertSame(21, (int) $data['stale_after_days']);
        Tenant::forgetCurrent();
    }

    public function test_notification_settings_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_notifications');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $payload = NotificationSettings::defaults();
        $payload['email'] = false;
        $payload['lead_stage_changed'] = true;
        $payload['task_due'] = false;

        $this->put(Domain::portal('/settings/notifications'), $payload)
            ->assertRedirect();

        $tenant->makeCurrent();
        $data = Setting::group(Setting::GROUP_NOTIFICATIONS);
        $this->assertFalse((bool) $data['email']);
        $this->assertTrue((bool) $data['in_app']);
        $this->assertTrue((bool) $data['lead_stage_changed']);
        $this->assertFalse((bool) $data['task_due']);
        Tenant::forgetCurrent();
    }

    public function test_notification_settings_require_every_preference(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_notifications_invalid');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/notifications'), [
            'in_app' => true,
        ])->assertSessionHasErrors('email');
    }

    public function test_meta_data_can_be_updated_and_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_meta');

        $tenant->makeCurrent();
        $meta = MetaData::query()->create([
            'type' => MetaData::TYPE_CITY,
            'value' => 'Old City',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/meta-data/'.$meta->id), [
            'value' => 'New City',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame('New City', $meta->fresh()->value);
        Tenant::forgetCurrent();

        $this->delete(Domain::portal('/meta-data/'.$meta->id))
            ->assertRedirect();

        $tenant->makeCurrent();
        $this->assertNull(MetaData::query()->find($meta->id));
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
