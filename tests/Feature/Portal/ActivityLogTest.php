<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LogActivity;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ActivityLogTest extends TestCase
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

    public function test_signed_in_changes_are_stored_on_the_activity_log(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_activity_log_write');

        $this->actingAs($user);
        $tenant->makeCurrent();

        $lead = Lead::factory()->create([
            'user_id' => $user->id,
            'source' => 'Website',
            'notes' => 'First note',
        ]);

        $created = LogActivity::query()
            ->where('logable_type', Lead::class)
            ->where('logable_id', $lead->id)
            ->where('action', 'created')
            ->first();

        $this->assertNotNull($created);
        $this->assertSame($user->id, $created->user_id);
        $this->assertSame('Website', $created->changes['source'] ?? null);

        $lead->update(['notes' => 'Updated note']);

        $updated = LogActivity::query()
            ->where('logable_type', Lead::class)
            ->where('logable_id', $lead->id)
            ->where('action', 'updated')
            ->latest('id')
            ->first();

        $this->assertNotNull($updated);
        $this->assertSame('First note', $updated->previous['notes'] ?? null);
        $this->assertSame('Updated note', $updated->changes['notes'] ?? null);

        $user->update([
            'display_name' => 'Renamed Agent',
            'password' => 'a-new-secret-password',
        ]);

        $userLog = LogActivity::query()
            ->where('logable_type', User::class)
            ->where('logable_id', $user->id)
            ->where('action', 'updated')
            ->first();

        $this->assertNotNull($userLog);
        $this->assertSame('Renamed Agent', $userLog->changes['display_name'] ?? null);
        $this->assertArrayNotHasKey('password', $userLog->changes ?? []);
        $this->assertArrayNotHasKey('password', $userLog->previous ?? []);

        Tenant::forgetCurrent();
    }

    public function test_guests_do_not_write_activity_logs(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_activity_log_guest');

        $tenant->makeCurrent();
        Lead::factory()->create([
            'user_id' => $user->id,
            'source' => 'Website',
        ]);

        $this->assertSame(0, LogActivity::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_activity_page_filters_by_section(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_activity_log_index');

        $this->actingAs($user);
        $tenant->makeCurrent();
        Lead::factory()->create([
            'user_id' => $user->id,
            'source' => 'Website',
        ]);
        Contact::factory()->create([
            'first_name' => 'Ayesha',
            'last_name' => 'Khan',
        ]);
        Tenant::forgetCurrent();

        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/activity?section=contacts'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('activity/index')
                ->where('filters.section', ['contacts'])
                ->has('formOptions.sections')
                ->has('formOptions.actions')
                ->has('formOptions.users')
                ->has('logs.data', 2)
                ->where('logs.data.0.section', 'contacts')
                ->where('logs.data.0.subject.label', 'Ayesha Khan')
                ->where('logs.data.1.section', 'contacts')
                ->where('logs.data.0.user.display_name', $user->display_name)
            );
    }

    public function test_activity_page_filters_by_action_and_actor(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_activity_log_filters');

        $this->actingAs($user);
        $tenant->makeCurrent();
        $lead = Lead::factory()->create([
            'user_id' => $user->id,
            'source' => 'Website',
            'notes' => 'Original',
        ]);
        $lead->update(['notes' => 'Changed']);
        Contact::factory()->create([
            'first_name' => 'Sara',
            'last_name' => 'Ali',
        ]);
        Tenant::forgetCurrent();

        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/activity?action=updated&user='.$user->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('activity/index')
                ->where('filters.action', ['updated'])
                ->where('filters.user', [(string) $user->id])
                ->has('logs.data', 1)
                ->where('logs.data.0.action', 'updated')
                ->where('logs.data.0.section', 'leads')
                ->where('logs.data.0.user.display_name', $user->display_name)
            );
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
