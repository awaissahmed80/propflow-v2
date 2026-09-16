<?php

namespace Tests\Feature\Portal;

use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class FileManagerPageTest extends TestCase
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

    public function test_guest_cannot_view_file_manager_page(): void
    {
        $this->get(Domain::portal('/file-manager'))
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_sees_file_manager_page(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_file_manager');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/file-manager'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('file-manager/index', false)
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
