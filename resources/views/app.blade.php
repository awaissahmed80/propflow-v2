<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script>
            (function () {
                // Marketing site always uses the portal light shadcn theme.
                document.documentElement.classList.remove('dark');
            })();
        </script>

        {{-- <link rel="icon" href="/favicon.ico" sizes="any"> --}}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link href="https://cdn.jsdelivr.net/npm/remixicon@4.9.1/fonts/remixicon.css" rel="stylesheet" />
        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/apps/public/index.jsx', "resources/js/apps/public/pages/{$page['component']}.jsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
