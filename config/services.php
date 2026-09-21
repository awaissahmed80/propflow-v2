<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'meta' => [
        'app_id' => env('META_APP_ID'),
        'app_secret' => env('META_APP_SECRET'),
        'redirect' => env('META_REDIRECT_URI'),
        'graph_version' => env('META_GRAPH_VERSION', 'v21.0'),
        'scopes' => array_values(array_filter(array_map(
            static fn (string $scope): string => trim($scope),
            explode(',', (string) env(
                'META_SCOPES',
                'pages_show_list,pages_manage_ads,pages_manage_metadata,pages_read_engagement,leads_retrieval,ads_management,pages_messaging,instagram_basic,instagram_manage_messages,business_management'
            ))
        ))),
        'webhook_verify_token' => env('META_WEBHOOK_VERIFY_TOKEN'),
    ],

    /*
    | WhatsApp Cloud API uses the Meta platform app by default.
    | Tenants connect their own WABA; messaging charges stay with Meta.
    */
    'whatsapp' => [
        'app_id' => env('WHATSAPP_APP_ID', env('META_APP_ID')),
        'app_secret' => env('WHATSAPP_APP_SECRET', env('META_APP_SECRET')),
        'redirect' => env('WHATSAPP_REDIRECT_URI'),
        'graph_version' => env('WHATSAPP_GRAPH_VERSION', env('META_GRAPH_VERSION', 'v21.0')),
        'scopes' => array_values(array_filter(array_map(
            static fn (string $scope): string => trim($scope),
            explode(',', (string) env(
                'WHATSAPP_SCOPES',
                'whatsapp_business_management,whatsapp_business_messaging,business_management'
            ))
        ))),
        'webhook_verify_token' => env('WHATSAPP_WEBHOOK_VERIFY_TOKEN', env('META_WEBHOOK_VERIFY_TOKEN')),
        // WhatsApp-only Login for Business / Embedded Signup configuration.
        // Must not reuse a Meta Lead Ads (Pages/Instagram) configuration.
        'config_id' => env('WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID'),
    ],

];
