<?php

namespace Tests\Unit\Support;

use App\Support\MapEmbed;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MapEmbedTest extends TestCase
{
    #[Test]
    public function it_extracts_src_from_iframe_embed(): void
    {
        $embed = '<iframe src="https://www.google.com/maps/embed?pb=abc" width="600" height="450"></iframe>';

        $this->assertSame(
            'https://www.google.com/maps/embed?pb=abc',
            MapEmbed::src($embed)
        );
    }

    #[Test]
    public function it_accepts_direct_google_maps_urls(): void
    {
        $url = 'https://maps.google.com/maps?q=islamabad';

        $this->assertSame($url, MapEmbed::src($url));
    }

    #[Test]
    public function it_rejects_untrusted_hosts(): void
    {
        $this->assertNull(MapEmbed::src('https://evil.example/maps'));
        $this->assertNull(MapEmbed::src('<iframe src="https://evil.example/x"></iframe>'));
    }
}
