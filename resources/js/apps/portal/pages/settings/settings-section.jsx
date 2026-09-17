import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/**
 * Shared settings content block with optional title / icon.
 */
export function SettingsSection({
    title,
    description,
    icon,
    children,
    className,
    actions = null,
}) {
    return (
        <section
            className={cn(
                "rounded-xl border border-border/80 bg-card/40 shadow-xs",
                className
            )}
        >
            {(title || actions) && (
                <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            {icon ? (
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                    <Icon name={icon} className="text-base" />
                                </span>
                            ) : null}
                            {title ? (
                                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                    {title}
                                </h3>
                            ) : null}
                        </div>
                        {description ? (
                            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                        ) : null}
                    </div>
                    {actions}
                </div>
            )}
            <div className="px-5 py-5">{children}</div>
        </section>
    );
}
