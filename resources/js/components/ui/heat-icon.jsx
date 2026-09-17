import { Icon } from "@/components/ui/icon";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { heatMeta } from "@/lib/heat";
import { cn } from "@/lib/utils";

/**
 * Colored heat icon with label tooltip.
 *
 * @param {object} props
 * @param {string} [props.tag]
 * @param {string} [props.className]
 * @param {string} [props.iconClassName]
 * @param {boolean} [props.showTooltip]
 */
function HeatIcon({
    tag,
    className,
    iconClassName = "text-base leading-none",
    showTooltip = true,
}) {
    const meta = heatMeta(tag);

    if (!meta) {
        return null;
    }

    const trigger = (
        <span
            className={cn(
                "inline-flex shrink-0 items-center justify-center",
                meta.className,
                className
            )}
            aria-label={meta.label}
        >
            <Icon name={meta.icon} className={iconClassName} />
        </span>
    );

    if (!showTooltip) {
        return trigger;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={trigger} />
            <TooltipContent side="top">{meta.label}</TooltipContent>
        </Tooltip>
    );
}

/**
 * Selectable heat icon button with tooltip.
 *
 * @param {object} props
 * @param {string} props.tag
 * @param {boolean} [props.selected]
 * @param {() => void} [props.onClick]
 * @param {string} [props.className]
 * @param {"button" | "submit" | "reset"} [props.type]
 */
function HeatIconButton({
    tag,
    selected = false,
    onClick,
    className,
    type = "button",
}) {
    const meta = heatMeta(tag);

    if (!meta) {
        return null;
    }

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <button
                        type={type}
                        data-selected={selected ? "true" : "false"}
                        aria-label={meta.label}
                        aria-pressed={selected}
                        onClick={onClick}
                        className={cn(
                            "inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                            selected
                                ? "border-primary/40 bg-primary/10 ring-1 ring-primary/30"
                                : "border-border bg-background hover:bg-muted/50",
                            meta.className,
                            !selected && "opacity-80 hover:opacity-100",
                            className
                        )}
                    >
                        <Icon name={meta.icon} className="text-base leading-none" />
                    </button>
                }
            />
            <TooltipContent side="top">{meta.label}</TooltipContent>
        </Tooltip>
    );
}

export { HeatIcon, HeatIconButton };
