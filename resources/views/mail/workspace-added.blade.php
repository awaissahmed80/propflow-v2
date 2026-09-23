<x-mail::message>
# You've been added to {{ $workspace }}

{{ $inviterName }} added you to the **{{ $workspace }}** workspace on Propflow.

Sign in with your existing Propflow account to open this workspace.

<x-mail::button :url="$loginUrl">
Sign in
</x-mail::button>

Or go directly to the portal: [{{ $portalUrl }}]({{ $portalUrl }})

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
