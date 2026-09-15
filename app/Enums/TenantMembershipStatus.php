<?php

namespace App\Enums;

enum TenantMembershipStatus: string
{
    case Active = 'ACTIVE';
    case Inactive = 'INACTIVE';
    case Blocked = 'BLOCKED';
}
