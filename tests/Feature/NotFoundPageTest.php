<?php

namespace Tests\Feature;

use App\Support\Domain;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class NotFoundPageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.base_domain' => 'propflow.test',
            'app.url_scheme' => 'https',
        ]);
    }

    public function test_unknown_public_route_renders_not_found_page(): void
    {
        $this->get(Domain::url(null, '/this-page-does-not-exist'))
            ->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page
                ->component('errors/not-found')
                ->where('status', 404)
                ->where('homeUrl', Domain::url(null, '/'))
                ->where('portalUrl', Domain::portal())
                ->where('authUrl', Domain::auth())
            );
    }

    public function test_unknown_portal_route_renders_not_found_page(): void
    {
        $this->get(Domain::portal('/this-page-does-not-exist'))
            ->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page
                ->component('errors/not-found')
                ->where('status', 404)
                ->where('homeUrl', Domain::portal())
                ->where('portalUrl', Domain::portal())
            );
    }
}
