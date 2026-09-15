<?php

namespace App\Enums;

enum UserType: string
{
    case Platform = 'platform';
    case Tenant = 'tenant';
}
