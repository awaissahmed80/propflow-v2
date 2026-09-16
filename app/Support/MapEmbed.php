<?php

namespace App\Support;

class MapEmbed
{
    /**
     * Extract a safe map iframe src from an embed snippet or absolute URL.
     */
    public static function src(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (filter_var($value, FILTER_VALIDATE_URL)) {
            return self::isAllowedSrc($value) ? $value : null;
        }

        if (preg_match('/src\s*=\s*["\']([^"\']+)["\']/i', $value, $matches) !== 1) {
            return null;
        }

        $src = html_entity_decode($matches[1], ENT_QUOTES | ENT_HTML5);

        return self::isAllowedSrc($src) ? $src : null;
    }

    protected static function isAllowedSrc(string $src): bool
    {
        if (filter_var($src, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $host = parse_url($src, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            return false;
        }

        $host = strtolower($host);

        $allowed = [
            'google.com',
            'www.google.com',
            'maps.google.com',
            'www.maps.google.com',
            'maps.google.co.uk',
            'googleusercontent.com',
            'www.googleusercontent.com',
            'openstreetmap.org',
            'www.openstreetmap.org',
            'www.openstreetmap.fr',
        ];

        foreach ($allowed as $allowedHost) {
            if ($host === $allowedHost || str_ends_with($host, '.'.$allowedHost)) {
                return true;
            }
        }

        return str_ends_with($host, '.google.com')
            || str_ends_with($host, '.googleusercontent.com')
            || str_ends_with($host, '.openstreetmap.org');
    }
}
