import { Sidebar } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icon } from "@/components/ui/icon";
import { menu_items } from "../utils/menu_items";
import { NavLink } from "./nav-link";
import { NavUser } from "./nav-user";

export function AppSidebar() {
    return (
        <Sidebar
            collapsible="offcanvas"
            variant="sidebar"
            className="flex h-screen flex-col overflow-hidden p-0!"
        >
            <div className="h-full border-r-0">
                <div className="flex h-full flex-col">
                    <div className="flex items-center border-b-0">
                        <div className="px-5 py-5">
                            <img
                                className="block h-8 w-auto dark:hidden"
                                src="/assets/images/propflow-logo-light.svg"
                                alt="Propflow"
                            />
                            <img
                                className="hidden h-8 w-auto dark:block"
                                src="/assets/images/propflow-logo-dark.svg"
                                alt="Propflow"
                            />
                        </div>
                    </div>
                    <div className="relative flex-1">
                        <div className="absolute inset-0">
                            <ScrollArea className="h-full">
                                <div className="space-y-8 p-5">
                                    {menu_items?.map((group, g) => (
                                        <div key={g} className="space-y-1">
                                            <div className="mb-3 px-3 text-sm font-bold tracking-tight text-sidebar-foreground/40">
                                                {group?.title}
                                            </div>
                                            {group?.items?.map((item) => (
                                                <NavLink
                                                    href={item?.to}
                                                    component={item?.component}
                                                    end={Boolean(item?.end)}
                                                    activeWhen={item?.activeWhen}
                                                    key={`${item?.label}-${item?.to}`}
                                                    className="flex flex-row items-center rounded-md px-3 py-1 text-sm font-medium hover:bg-card"
                                                >
                                                    <Icon name={item?.icon} className="w-8 text-lg" />
                                                    {item?.label}
                                                </NavLink>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <div className="border-t border-sidebar-border/50 p-3">
                        <NavUser />
                    </div>
                </div>
            </div>
        </Sidebar>
    );
}
