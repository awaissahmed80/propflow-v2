import { dashboard } from "@/routes/portal";
import { index as campaigns } from "@/routes/portal/campaigns";
import { index as contacts } from "@/routes/portal/contacts";
import { index as inventory } from "@/routes/portal/inventory";
import { index as leads } from "@/routes/portal/leads";
import { index as projects } from "@/routes/portal/projects";
import { index as roles } from "@/routes/portal/roles";
import { index as settings } from "@/routes/portal/settings";
import { index as teams } from "@/routes/portal/teams";
import { index as users } from "@/routes/portal/users";

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
                icon: "dashboard-2-line",
                end: true,
            },
            { label: "Leads", to: pathFrom(leads.url()), icon: "customer-service-line" },
            { label: "Campaigns", to: pathFrom(campaigns.url()), icon: "focus-3-line" },
            { label: "Projects", to: pathFrom(projects.url()), icon: "community-line" },
            { label: "Inventory", to: pathFrom(inventory.url()), icon: "shape-line" },
            { label: "Teams", to: pathFrom(teams.url()), icon: "user-community-line" },
            { label: "Users", to: pathFrom(users.url()), icon: "user-2-line" },
            { label: "Contacts", to: pathFrom(contacts.url()), icon: "folder-user-line" },
            { label: "Calendar", to: "/calendar", icon: "calendar-line" },
        ],
    },
    {
        title: "Operations",
        items: [
            { label: "Orders", to: "/orders", icon: "book-2-line" },
            { label: "Payment Plans", to: "/payment-plans", icon: "calendar-schedule-line" },
            { label: "Allocation", to: "/Allocation", icon: "shape-line" },
        ],
    },
    {
        title: "Library",
        items: [
            { label: "Files & Media", to: "/file-manager", icon: "folder-2-line" },
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
            { label: "Roles", to: pathFrom(roles.url()), icon: "checkbox-multiple-line" },
            { label: "Settings", to: pathFrom(settings.url()), icon: "settings-2-line" },
        ],
    },
];

export const dashboardUrl = dashboardPath === "/" ? "/dashboard" : dashboardPath;
