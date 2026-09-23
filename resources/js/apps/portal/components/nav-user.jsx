import { useEffect, useState } from "react"
import { router, usePage } from "@inertiajs/react"
import { toast } from "sonner"
import { Avatar } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Icon } from "@/components/ui/icon"
import { Switch } from "@/components/ui/switch"
import { useAppearance } from "@/hooks/use-appearance"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

function UserIdentity({ user, workspaceName, className }) {
    const name = user?.display_name || "User"
    const email = user?.email_address || ""

    return (
        <div className={cn("flex min-w-0 items-center gap-3", className)}>
            <Avatar name={name} size="default" className="size-9" textClass="text-sm" />
            <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-sidebar-foreground">
                    {name}
                </div>
                <div className="truncate text-xs text-sidebar-foreground/50">
                    {workspaceName || email}
                </div>
            </div>
        </div>
    )
}

export function NavUser() {
    const { user } = useAuth()
    const { tenant } = usePage().props
    const { updateAppearance } = useAppearance()
    const [darkMode, setDarkMode] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const [switchingId, setSwitchingId] = useState(null)

    const currentWorkspace = tenant?.current || null
    const workspaces = Array.isArray(tenant?.available) ? tenant.available : []
    const canSwitchWorkspace = workspaces.length > 1

    useEffect(() => {
        setDarkMode(document.documentElement.classList.contains("dark"))
    }, [])

    const toggleTheme = (checked) => {
        updateAppearance(checked ? "dark" : "light")
        setDarkMode(checked)
    }

    const logout = () => {
        if (loggingOut) {
            return
        }

        setLoggingOut(true)

        router.post(
            "/logout",
            {},
            {
                onSuccess: (page) => {
                    if (page.props.status === "logged_out" && page.props.redirect) {
                        window.location.assign(page.props.redirect)
                        return
                    }
                },
                onError: () => {
                    toast.error("Unable to log out. Please try again.")
                },
                onFinish: () => setLoggingOut(false),
            }
        )
    }

    const switchWorkspace = (tenantId) => {
        if (!tenantId || tenantId === currentWorkspace?.id || switchingId !== null) {
            return
        }

        setSwitchingId(tenantId)

        router.post(
            "/workspaces/switch",
            { tenant_id: tenantId },
            {
                onError: (errors) => {
                    toast.error(
                        errors.tenant_id || errors.message || "Unable to switch workspace"
                    )
                },
                onFinish: () => setSwitchingId(null),
            }
        )
    }

    if (!user) {
        return null
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex h-auto w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
                <UserIdentity
                    user={user}
                    workspaceName={currentWorkspace?.name}
                    className="flex-1"
                />
                <Icon
                    name="expand-up-down-line"
                    className="shrink-0 text-base text-sidebar-foreground/60"
                />
            </DropdownMenuTrigger>

            <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-(--anchor-width) rounded-lg p-0 ring-1 ring-border"
            >
                <div className="px-3 py-3">
                    <UserIdentity user={user} workspaceName={user?.email_address} />
                </div>

                <DropdownMenuSeparator className="my-0" />

                <DropdownMenuGroup className="p-1">
                    <DropdownMenuLabel className="px-2 pt-1 pb-1">Workspace</DropdownMenuLabel>
                    {workspaces.length === 0 && currentWorkspace ? (
                        <div className="flex items-center gap-2 rounded-sm bg-primary/10 px-2 py-2 text-sm font-medium text-primary">
                            <Icon name="building-line" className="text-base text-primary" />
                            <span className="min-w-0 flex-1 truncate">{currentWorkspace.name}</span>
                            <Icon name="check-line" className="text-base text-primary" />
                        </div>
                    ) : (
                        workspaces.map((workspace) => {
                            const isCurrent = workspace.id === currentWorkspace?.id
                            const isSwitching = switchingId === workspace.id

                            return (
                                <DropdownMenuItem
                                    key={workspace.id}
                                    className={cn(
                                        "gap-2 px-2 py-2",
                                        isCurrent &&
                                            "bg-primary/10 font-medium text-primary focus:bg-primary/15 focus:text-primary"
                                    )}
                                    disabled={isSwitching || switchingId !== null}
                                    onClick={() => {
                                        if (!isCurrent) {
                                            switchWorkspace(workspace.id)
                                        }
                                    }}
                                >
                                    <Icon
                                        name="building-line"
                                        className={cn(
                                            "text-base",
                                            isCurrent && "text-primary"
                                        )}
                                    />
                                    <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                                    {isSwitching ? (
                                        <Icon
                                            name="loader-4-line"
                                            className="animate-spin text-base text-muted-foreground"
                                        />
                                    ) : isCurrent ? (
                                        <Icon
                                            name="check-line"
                                            className="text-base text-primary"
                                        />
                                    ) : canSwitchWorkspace ? (
                                        <Icon
                                            name="arrow-right-s-line"
                                            className="text-base text-muted-foreground"
                                        />
                                    ) : null}
                                </DropdownMenuItem>
                            )
                        })
                    )}
                </DropdownMenuGroup>

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
                        {loggingOut ? "Logging out..." : "Logout"}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
