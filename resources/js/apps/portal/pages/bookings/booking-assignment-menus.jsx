import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { update } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { SelectBox } from "@/components/ui/select";

function patchBooking(order, payload, successMessage) {
    router.patch(update.url(order.code), payload, {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => toast.success(successMessage),
        onError: (errors) => toast.error(Object.values(errors)[0] || "Could not update booking"),
    });
}

export function BookingAssigneeMenu({ order, assignees = [] }) {
    const options = assignees.map((user) => ({
        value: String(user.id),
        label: user.display_name,
        avatar: {
            name: user.display_name,
            src: user.avatar || undefined,
        },
    }));

    return (
        <SelectBox
            className="min-w-0 flex-1"
            value={order?.assigned_to ? String(order.assigned_to) : ""}
            options={options}
            placeholder="Assign to…"
            clearable
            onValueChange={(value) => {
                const next = value ? Number(value) : null;

                if ((order?.assigned_to ?? null) === next) {
                    return;
                }

                patchBooking(
                    order,
                    { assigned_to: next },
                    next ? "Assignee updated" : "Assignee cleared",
                );
            }}
        />
    );
}

export function BookingProjectMenu({ order, projects = [] }) {
    const options = projects.map((project) => ({
        value: String(project.id),
        label: project.title,
        image: project.thumbnail || undefined,
        icon: project.thumbnail ? undefined : "community-line",
    }));

    return (
        <SelectBox
            className="min-w-0 flex-1"
            value={order?.project?.id ? String(order.project.id) : ""}
            options={options}
            placeholder="Select project…"
            clearable
            onValueChange={(value) => {
                const next = value ? Number(value) : null;

                if ((order?.project?.id ?? null) === next) {
                    return;
                }

                patchBooking(
                    order,
                    { project_id: next },
                    next ? "Project updated" : "Project cleared",
                );
            }}
        />
    );
}
