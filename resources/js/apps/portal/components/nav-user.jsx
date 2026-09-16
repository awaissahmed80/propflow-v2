import { useEffect, useState } from "react"
import { router } from "@inertiajs/react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Icon } from "@/components/ui/icon"
import { Switch } from "@/components/ui/switch"
import { useAppearance } from "@/hooks/use-appearance"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

function userInitials(user) {
    const fromName = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.trim();

    if (fromName) {
        return fromName.toUpperCase();
    }

    const parts = String(user?.display_name ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return (parts[0]?.[0] ?? user?.email_address?.[0] ?? '?').toUpperCase();
}

function UserIdentity({ user, className }) {
    const name = user?.display_name || 'User';
    const email = user?.email_address || '';

    return (
        <div className={cn("flex min-w-0 items-center gap-3", className)}>
            <Avatar size="default" className="size-9">
                <AvatarFallback className="bg-lime-800 text-sm font-semibold text-lime-50">
                    {userInitials(user)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-sidebar-foreground">
                    {name}
                </div>
                <div className="truncate text-xs text-sidebar-foreground/50">
                    {email}
                </div>
            </div>
        </div>
    );
}

export function NavUser() {
    const { user } = useAuth();
    const { updateAppearance } = useAppearance();
    const [darkMode, setDarkMode] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        setDarkMode(document.documentElement.classList.contains('dark'));
    }, []);

    const toggleTheme = (checked) => {
        updateAppearance(checked ? 'dark' : 'light');
        setDarkMode(checked);
    };

    const logout = () => {
        if (loggingOut) {
            return;
        }

        setLoggingOut(true);

        router.post('/logout', {}, {
            onSuccess: (page) => {
                if (page.props.status === 'logged_out' && page.props.redirect) {
                    window.location.assign(page.props.redirect);
                    return;
                }
            },
            onError: () => {
                toast.error('Unable to log out. Please try again.');
            },
            onFinish: () => setLoggingOut(false),
        });
    };

    if (! user) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex h-auto w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
                <UserIdentity user={user} className="flex-1" />
                <Icon
                    name="expand-up-down-line"
                    className="shrink-0 text-base text-sidebar-foreground/60"
                />
            </DropdownMenuTrigger>

            <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-(--anchor-width) min-w-56 rounded-lg p-0 ring-1 ring-border"
            >
                <div className="px-3 py-3">
                    <UserIdentity user={user} />
                </div>

                <DropdownMenuSeparator className="my-0" />

                <div
                    className="flex items-center gap-2 px-3 py-2.5"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <Icon name="moon-line" className="text-base text-popover-foreground" />
                    <span className="flex-1 text-sm text-popover-foreground">Dark Mode</span>
                    <Switch checked={darkMode} onCheckedChange={toggleTheme} />
                </div>

                <DropdownMenuSeparator className="my-0" />

                <DropdownMenuGroup className="p-1">
                    <DropdownMenuItem className="gap-2 px-2 py-2">
                        <Icon name="user-line" className="text-base" />
                        Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 px-2 py-2">
                        <Icon name="equalizer-line" className="text-base" />
                        Preferences
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="gap-2 px-2 py-2"
                        disabled={loggingOut}
                        onClick={logout}
                    >
                        <Icon name="logout-box-r-line" className="text-base" />
                        {loggingOut ? 'Logging out...' : 'Logout'}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
