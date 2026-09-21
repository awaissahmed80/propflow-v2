import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { notifications as updateNotifications } from "@/routes/portal/settings";
import { Icon } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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

function readValues(notifications = {}, catalog = []) {
    const keys = catalog.flatMap((group) => (group.items ?? []).map((item) => item.key));
    const source = keys.length > 0 ? keys : Object.keys(notifications);

    return Object.fromEntries(source.map((key) => [key, Boolean(notifications[key])]));
}

function SettingRow({ title, description, checked, onCheckedChange, disabled = false, last = false }) {
    return (
        <div className={cn("px-5 py-4", !last && "border-b border-border/60")}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-base font-bold tracking-tight text-foreground">{title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                </div>
                <Switch
                    className="mt-0.5 shrink-0"
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={onCheckedChange}
                    aria-label={title}
                />
            </div>
        </div>
    );
}

export default function NotificationsPanel({
    section,
    notifications = {},
    notificationCatalog = [],
}) {
    const [processing, setProcessing] = useState(false);
    const [values, setValues] = useState(() => readValues(notifications, notificationCatalog));
    const valuesRef = useRef(values);

    useEffect(() => {
        const next = readValues(notifications, notificationCatalog);
        setValues(next);
        valuesRef.current = next;
    }, [notifications, notificationCatalog]);

    const persist = (next) => {
        valuesRef.current = next;
        setValues(next);
        setProcessing(true);

        router.put(pathFrom(updateNotifications.url()), next, {
            preserveScroll: true,
            preserveState: "errors",
            optimistic: (props) => ({
                notifications: {
                    ...(props.notifications ?? {}),
                    ...next,
                },
            }),
            onError: (errors) => toast.error(errors.message || "Unable to save notification settings"),
            onFinish: () => setProcessing(false),
        });
    };

    const toggle = (key, value) => {
        persist({
            ...valuesRef.current,
            [key]: Boolean(value),
        });
    };

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-10 -mx-6 border-b border-border/60 px-6 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-foreground shadow-xs ring-1 ring-border/70">
                        <Icon
                            name={section?.icon || "notification-3-line"}
                            className="text-base"
                        />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold tracking-tight text-foreground">
                            {section?.label ?? "Notifications"}
                        </h2>
                        <p className="truncate text-xs text-muted-foreground">
                            Workspace defaults. People can narrow these in their own preferences later.
                        </p>
                    </div>
                </div>
            </div>

            {notificationCatalog.map((group) => (
                <section key={group.id} className="space-y-3">
                    <div>
                        <h3 className="text-base font-bold tracking-tight text-foreground">
                            {group.label}
                        </h3>
                        {group.description ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>
                        ) : null}
                    </div>
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-xs">
                        {(group.items ?? []).map((item, index, items) => (
                            <SettingRow
                                key={item.key}
                                title={item.title}
                                description={item.description}
                                checked={Boolean(values[item.key])}
                                disabled={processing}
                                last={index === items.length - 1}
                                onCheckedChange={(value) => toggle(item.key, value)}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
