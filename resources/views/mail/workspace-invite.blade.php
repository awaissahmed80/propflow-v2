<x-mail::message>
# You're invited to {{ $workspace }}

{{ $inviterName }} invited you to join **{{ $workspace }}** on Propflow.

Accept the invite to join this workspace. You won’t have access until you accept.

<x-mail::button :url="$acceptUrl">
Accept invitation
</x-mail::button>

This invitation expires on {{ $expiresAt->timezone(config('app.timezone'))->format('d M Y \a\t H:i') }}.

If you weren't expecting this email, you can ignore it.

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
