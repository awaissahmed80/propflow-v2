<?php

namespace Tests\Feature\Auth;

use App\Support\Domain;
use Inertia\Support\Header as InertiaHeader;
use Tests\TestCase;

class InertiaGuestRedirectTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.base_domain' => 'propflow.test',
            'app.url_scheme' => 'https',
        ]);
    }

    public function test_inertia_guest_visit_to_portal_forces_external_auth_location(): void
    {
        $response = $this->withHeaders([
            InertiaHeader::INERTIA => 'true',
            InertiaHeader::VERSION => 'test',
            'X-Requested-With' => 'XMLHttpRequest',
            'Accept' => 'text/html, application/xhtml+xml',
        ])->get(Domain::portal('/leads'));

        $response->assertStatus(409);
        $response->assertHeader(InertiaHeader::LOCATION, Domain::auth());
    }

    public function test_browser_guest_visit_to_portal_still_redirects_to_auth(): void
    {
        $this->get(Domain::portal('/leads'))
            ->assertRedirect(Domain::auth());
    }
}
