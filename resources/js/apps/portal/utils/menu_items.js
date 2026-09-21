import { dashboard } from "@/routes/portal";
import { index as activity } from "@/routes/portal/activity";
import { index as campaigns } from "@/routes/portal/campaigns";
import { index as contacts } from "@/routes/portal/contacts";
import { index as inventory } from "@/routes/portal/inventory";
import { index as leads } from "@/routes/portal/leads";
import { index as projects } from "@/routes/portal/projects";
import { index as settings } from "@/routes/portal/settings";
import { index as teams } from "@/routes/portal/teams";
import { index as users } from "@/routes/portal/users";
import { index as calendar } from "@/actions/App/Http/Controllers/Portal/CalendarController";

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const pathname = new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname;

            return pathname === "" ? "/" : pathname;
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

/** Prefer /dashboard so sidebar navigation is never ambiguous with Inertia root "/". */
const dashboardPath = pathFrom(dashboard.url()) || "/dashboard";

export const menu_items = [
    {
        title: "Home",
        items: [
            {
                label: "Dashboard",
                to: dashboardPath === "/" ? "/dashboard" : dashboardPath,
                component: "dashboard/index",
                icon: "dashboard-2-line",
                end: true,
            },
            {
                label: "Todo List",
                to: "/todos",
                component: "todos/index",
                icon: "checkbox-line",
            },
            {
                label: "Calendar",
                to: pathFrom(calendar.url()),
                component: "calendar/index",
                icon: "calendar-line",
            },
        ],
    },
    {
        title: "Sales",
        items: [
            {
                label: "Overview",
                to: "/sales",
                component: "sales/overview",
                icon: "line-chart-line",
                end: true,
            },
            {
                label: "Leads",
                to: pathFrom(leads.url()),
                component: "leads/index",
                icon: "customer-service-line",
            },
            {
                label: "Campaigns",
                to: pathFrom(campaigns.url()),
                component: "campaigns/index",
                icon: "focus-3-line",
            },
        ],
    },
    {
        title: "Operations",
        items: [
            {
                label: "Overview",
                to: "/operations",
                component: "operations/overview",
                icon: "line-chart-line",
                end: true,
            },
            {
                label: "Bookings",
                to: "/bookings",
                component: "bookings/index",
                icon: "book-2-line",
                activeWhen: (current) =>
                    current === "/bookings" || current.startsWith("/bookings/"),
            },
            {
                label: "Plan Templates",
                to: "/plan-templates",
                component: "plan-templates/index",
                icon: "file-list-3-line",
            },
            {
                label: "Receivables",
                to: "/receivables",
                component: "receivables/installments",
                icon: "wallet-3-line",
                activeWhen: (current) => current.startsWith("/receivables"),
            },
            {
                label: "Commissions",
                to: "/commissions",
                component: "operations/coming-soon",
                icon: "hand-coin-line",
                activeWhen: (current) => current.startsWith("/commissions"),
            },
        ],
    },
    {
        title: "General",
        items: [
            {
                label: "Projects",
                to: pathFrom(projects.url()),
                component: "projects/index",
                icon: "community-line",
            },
            {
                label: "Inventory",
                to: pathFrom(inventory.url()),
                component: "inventory/index",
                icon: "shape-line",
            },
            {
                label: "Users",
                to: pathFrom(users.url()),
                component: "users/index",
                icon: "user-2-line",
            },
            {
                label: "Teams",
                to: pathFrom(teams.url()),
                component: "teams/index",
                icon: "user-community-line",
            },
            {
                label: "Contacts",
                to: pathFrom(contacts.url()),
                component: "contacts/index",
                icon: "folder-user-line",
            },
        ],
    },
    {
        title: "Library",
        items: [
            {
                label: "Files & Media",
                to: "/file-manager",
                component: "file-manager/index",
                icon: "folder-2-line",
            },
        ],
    },
    {
        title: "Analytics",
        items: [
            { label: "Reports", to: "/reports", icon: "dashboard-2-line" },
            { label: "Forcasts", to: "/files", icon: "filter-line" },
            { label: "Finance", to: "/agreements", icon: "focus-3-line" },
        ],
    },
    {
        title: "Administration",
        items: [
            {
                label: "Activity",
                to: pathFrom(activity.url()),
                component: "activity/index",
                icon: "history-line",
            },
            {
                label: "Settings",
                to: pathFrom(settings.url()),
                component: "settings/index",
                icon: "settings-2-line",
            },
        ],
    },
];

export const dashboardUrl = dashboardPath === "/" ? "/dashboard" : dashboardPath;
