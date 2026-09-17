<?php

namespace App\Support;

class Domain
{
    public static function base(): string
    {
        return (string) config('app.base_domain', 'propflow.test');
    }

    public static function scheme(): string
    {
        return (string) config('app.url_scheme', 'https');
    }

    public static function host(?string $subdomain = null): string
    {
        $base = self::base();

        if ($subdomain === null || $subdomain === '') {
            return $base;
        }

        return $subdomain.'.'.$base;
    }

    public static function url(?string $subdomain = null, string $path = '/'): string
    {
        $path = '/'.ltrim($path, '/');

        if ($path === '/') {
            return self::scheme().'://'.self::host($subdomain);
        }

        return self::scheme().'://'.self::host($subdomain).$path;
    }

    public static function auth(string $path = '/'): string
    {
        return self::url('auth', $path);
    }

    public static function portal(string $path = '/'): string
    {
        return self::url('portal', $path);
    }

    public static function app(string $path = '/'): string
    {
        return self::url('app', $path);
    }
}
