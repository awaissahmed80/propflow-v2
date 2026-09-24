import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { update } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { Avatar } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

function patchBooking(order, payload, successMessage) {
    router.patch(update.url(order.code), payload, {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => toast.success(successMessage),
        onError: (errors) =>
            toast.error(Object.values(errors)[0] || "Could not update booking"),
    });
}

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.displayValue
 * @param {boolean} [props.disabled]
 * @param {import("react").ReactNode} [props.leading]
 * @param {string} [props.className]
 */
function HeaderValueTrigger({
    label,
    displayValue,
    disabled = false,
    leading = null,
    className,
    ...rest
}) {
    const empty = !displayValue || displayValue === "—";

    return (
        <button
            type="button"
            disabled={disabled}
            aria-label={`Edit ${label}`}
            title={`Click to edit ${label}`}
            className={cn(
                "-mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-sm transition-colors",
                "hover:bg-muted/60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:cursor-default disabled:hover:bg-transparent",
                "data-popup-open:bg-muted/60",
                empty ? "text-muted-foreground" : "text-foreground",
                className,
            )}
            {...rest}
        >
            {leading}
            <span className="whitespace-nowrap">{displayValue || "—"}</span>
        </button>
    );
}

/**
 * @param {object} props
 * @param {string} props.label
 * @param {import("react").ReactNode} props.children
 */
function HeaderField({ label, children }) {
    return (
        <div className="w-auto shrink-0 space-y-0.5">
            <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                {label}
            </div>
            {children}
        </div>
    );
}

export function BookingAssigneeMenu({ order, assignees = [], locked = false }) {
    const hasAssignees = assignees.length > 0;
    const selected =
        assignees.find((user) => Number(user.id) === Number(order?.assigned_to)) ||
        order?.assignee ||
        null;
    const displayValue = selected?.display_name || "—";
    const currentId = order?.assigned_to ?? null;

    if (!hasAssignees) {
        return (
            <HeaderField label="Assigned to">
                <span className="text-sm text-muted-foreground">No assignees added</span>
            </HeaderField>
        );
    }

    return (
        <HeaderField label="Assigned to">
            <DropdownMenu>
                <DropdownMenuTrigger
                    disabled={locked}
                    render={
                        <HeaderValueTrigger
                            label="assignee"
                            displayValue={displayValue}
                            disabled={locked}
                            leading={
                                selected ? (
                                    <Avatar
                                        name={selected.display_name}
                                        src={selected.avatar || undefined}
                                        size="sm"
                                        className="size-5 shrink-0"
                                        textClass="text-[8px]"
                                    />
                                ) : (
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                        <Icon name="user-line" className="text-xs" />
                                    </span>
                                )
                            }
                        />
                    }
                />
                <DropdownMenuContent align="start" className="min-w-48">
                    {assignees.map((user) => {
                        const selectedItem = Number(user.id) === Number(currentId);

                        return (
                            <DropdownMenuItem
                                key={user.id}
                                disabled={selectedItem || locked}
                                onClick={() => {
                                    if (selectedItem || locked) {
                                        return;
                                    }

                                    patchBooking(
                                        order,
                                        { assigned_to: Number(user.id) },
                                        "Assignee updated",
                                    );
                                }}
                            >
                                <Avatar
                                    name={user.display_name}
                                    src={user.avatar || undefined}
                                    size="sm"
                                    className="size-5 shrink-0"
                                    textClass="text-[8px]"
                                />
                                {user.display_name}
                                {selectedItem ? (
                                    <Icon name="check-line" className="ml-auto text-sm" />
                                ) : null}
                            </DropdownMenuItem>
                        );
                    })}
                    {currentId != null ? (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={locked}
                                onClick={() => {
                                    if (locked) {
                                        return;
                                    }

                                    patchBooking(
                                        order,
                                        { assigned_to: null },
                                        "Assignee cleared",
                                    );
                                }}
                            >
                                <Icon
                                    name="user-unfollow-line"
                                    className="text-base text-muted-foreground"
                                />
                                Unassigned
                            </DropdownMenuItem>
                        </>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        </HeaderField>
    );
}

export function BookingProjectField({ order }) {
    const project = order?.project;
    const unit = order?.unit;
    const title = project?.title || "—";
    const unitLabel = unit?.name || null;

    return (
        <HeaderField label="Project">
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                {project?.thumbnail ? (
                    <img
                        src={project.thumbnail}
                        alt=""
                        className="size-5 shrink-0 rounded object-cover"
                    />
                ) : (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                        <Icon name="community-line" className="text-xs" />
                    </span>
                )}
                <span className="truncate">{title}</span>
                {unitLabel ? (
                    <span className="truncate text-muted-foreground">· Unit {unitLabel}</span>
                ) : null}
            </div>
        </HeaderField>
    );
}
