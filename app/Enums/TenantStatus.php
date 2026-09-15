<?php

namespace App\Enums;

enum TenantStatus: string
{
    case Active = 'ACTIVE';
    case Inactive = 'INACTIVE';
    case Blocked = 'BLOCKED';
    case Suspended = 'SUSPENDED';
}
