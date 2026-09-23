import { Link, router } from "@inertiajs/react";
import { index as inventoryIndex } from "@/routes/portal/inventory";
import { UnitCard } from "../../components/unit-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyPanel, SidebarSection } from "./project-details-shared";

export function InventoryPanel({ project, units, stats = {} }) {
    const inventoryUrl = inventoryIndex.url({
        query: { project: project.code },
    });
    const totalUnits = Number(stats.units_count ?? units.length) || 0;

    const openUnitInInventory = (unit) => {
        const query = { project: project.code };

        if (unit?.name) {
            query.q = unit.name;
        } else if (unit?.code) {
            query.q = unit.code;
        }

        router.visit(inventoryIndex.url({ query }));
    };

    return (
        <SidebarSection
            title="Inventory"
            icon="shape-line"
            action={
                units.length > 0 ? (
                    <Link
                        href={inventoryUrl}
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                    >
                        View inventory
                    </Link>
                ) : null
            }
        >
            {units.length === 0 ? (
                <EmptyPanel
                    icon="shape-line"
                    message="No units yet for this project."
                    action={
                        <Link
                            href={inventoryUrl}
                            className={cn(buttonVariants({ variant: "secondary" }))}
                        >
                            Add Inventory
                        </Link>
                    }
                />
            ) : (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <span>
                            Showing {units.length} most recent
                            {totalUnits > units.length ? ` of ${totalUnits}` : ""} units
                        </span>
                        <span className="tabular-nums">
                            {[
                                stats.available_count != null
                                    ? `${stats.available_count} available`
                                    : null,
                                stats.sold_count != null ? `${stats.sold_count} sold` : null,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {units.map((unit) => (
                            <UnitCard
                                key={unit.id}
                                unit={unit}
                                onClick={openUnitInInventory}
                            />
                        ))}
                    </div>
                </div>
            )}
        </SidebarSection>
    );
}
