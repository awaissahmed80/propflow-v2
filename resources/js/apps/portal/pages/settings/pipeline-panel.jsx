import { useCallback, useEffect, useRef, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    destroy as destroyStage,
    reorder as reorderStages,
    store as storeStage,
    update as updateStage,
} from "@/actions/App/Http/Controllers/Portal/LeadStageController";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import PipelineRulesPanel from "./pipeline-rules-panel";
import { LeadActionTypesSection } from "./lead-action-types-section";
import {
    DEFAULT_COLOR,
    formatLeadCount,
    pathFrom,
    SortableStageCard,
    StageColorSwatch,
} from "./pipeline-stage-card";

export default function PipelinePanel({
    stages = [],
    pipelineRules = {},
    activityActionTypes = [],
    nextActionTypes = [],
}) {
    const [items, setItems] = useState(stages);
    const itemsRef = useRef(stages);
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newColor, setNewColor] = useState(DEFAULT_COLOR);
    const [processing, setProcessing] = useState(false);
    const dragOrderDirty = useRef(false);
    const addInputRef = useRef(null);

    useEffect(() => {
        setItems(stages);
        itemsRef.current = stages;
        dragOrderDirty.current = false;
    }, [stages]);

    useEffect(() => {
        if (adding) {
            requestAnimationFrame(() => addInputRef.current?.focus());
        }
    }, [adding]);

    const persistOrder = useCallback((nextItems) => {
        setProcessing(true);
        router.put(
            pathFrom(reorderStages.url()),
            { order: nextItems.map((stage) => stage.id) },
            {
                preserveScroll: true,
                optimistic: (props) => ({
                    stages: nextItems.map((stage, index) => ({
                        ...(props.stages?.find((item) => item.id === stage.id) ?? stage),
                        priority: index + 1,
                    })),
                }),
                onSuccess: () => {
                    dragOrderDirty.current = false;
                },
                onError: (errors) => toast.error(errors.order || errors.message || "Unable to reorder"),
                onFinish: () => setProcessing(false),
            }
        );
    }, []);

    const moveStage = useCallback((fromIndex, toIndex) => {
        setItems((prev) => {
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            itemsRef.current = next;
            dragOrderDirty.current = true;

            return next;
        });
    }, []);

    const handleDragEnd = useCallback(() => {
        if (!dragOrderDirty.current) {
            return;
        }

        persistOrder(itemsRef.current);
    }, [persistOrder]);

    const updateStageInline = (id, payload) => {
        if (processing) {
            return;
        }

        setProcessing(true);
        setItems((prev) =>
            prev.map((stage) => (stage.id === id ? { ...stage, ...payload } : stage))
        );

        const stage = items.find((item) => item.id === id);

        router.put(pathFrom(updateStage.url(stage?.label ?? id)), payload, {
            preserveScroll: true,
            optimistic: (props) => ({
                stages: (props.stages ?? []).map((stage) =>
                    stage.id === id ? { ...stage, ...payload } : stage
                ),
            }),
            onError: (errors) =>
                toast.error(errors.title || errors.stage || errors.message || "Unable to update"),
            onFinish: () => setProcessing(false),
        });
    };

    const createStage = (title, color = DEFAULT_COLOR) => {
        const value = title.trim();

        if (!value || processing) {
            return;
        }

        setProcessing(true);
        router.post(
            pathFrom(storeStage.url()),
            { title: value, color },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewTitle("");
                    setNewColor(DEFAULT_COLOR);
                    setAdding(false);
                },
                onError: (errors) => toast.error(errors.title || errors.message || "Unable to create"),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const duplicateStage = (stage) => {
        if (processing) {
            return;
        }

        createStage(`${stage.title} copy`, stage.color || DEFAULT_COLOR);
    };

    const removeStage = async (stage) => {
        if (processing || stage.is_system) {
            return;
        }

        const enabledRemaining = items.filter(
            (item) => item.id !== stage.id && item.is_enabled !== false
        ).length;

        if (enabledRemaining < 1) {
            await alert(
                "At least one enabled pipeline stage is required.",
                "Cannot delete stage"
            );
            return;
        }

        const leadCount = Number(stage.leads_count) || 0;
        const leadNote =
            leadCount > 0
                ? ` ${formatLeadCount(leadCount)} in this stage will be moved to the archive.`
                : "";

        const confirmed = await confirm(
            `Delete "${stage.title}"?${leadNote}`,
            "Delete stage"
        );

        if (!confirmed) {
            return;
        }

        setProcessing(true);
        router.delete(pathFrom(destroyStage.url(stage.label)), {
            preserveScroll: true,
            onSuccess: () =>
                toast.success(
                    leadCount > 0
                        ? "Stage deleted — leads moved to archive"
                        : "Stage deleted"
                ),
            onError: (errors) =>
                toast.error(errors.stage || errors.message || "Unable to delete"),
            onFinish: () => setProcessing(false),
        });
    };

    const toggleStageEnabled = (stage, nextEnabled) => {
        if (processing || !stage.is_system) {
            return;
        }

        if (!nextEnabled) {
            const enabledCount = items.filter((item) => item.is_enabled !== false).length;

            if (enabledCount <= 1) {
                toast.error("At least one enabled pipeline stage is required.");
                return;
            }
        }

        setItems((prev) =>
            prev.map((item) =>
                item.id === stage.id ? { ...item, is_enabled: nextEnabled } : item
            )
        );

        updateStageInline(stage.id, {
            title: stage.title,
            color: stage.color,
            is_enabled: nextEnabled,
        });
    };

    return (
        <div className="space-y-8">
                <section className="space-y-4">
                    <div>
                        <h3 className="text-base font-bold tracking-tight text-foreground">
                            Pipe Stages
                        </h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Lead pipeline — drag to reorder. Default stages can be turned off, not deleted.
                        </p>
                    </div>

                    <DndProvider backend={HTML5Backend}>
                        <div className="space-y-2">
                            {items.length === 0 && !adding ? (
                                <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                                    No stages yet. Add your first stage below.
                                </div>
                            ) : (
                                items.map((stage, index) => (
                                    <SortableStageCard
                                        key={stage.id}
                                        stage={stage}
                                        index={index}
                                        moveStage={moveStage}
                                        processing={processing}
                                        onUpdate={updateStageInline}
                                        onDuplicate={duplicateStage}
                                        onRemove={removeStage}
                                        onToggleEnabled={toggleStageEnabled}
                                        onDragEnd={handleDragEnd}
                                    />
                                ))
                            )}

                            {adding ? (
                                <form
                                    className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        createStage(newTitle, newColor);
                                    }}
                                >
                                    <span className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                                        <Icon name="add-line" className="text-base" />
                                    </span>
                                    <StageColorSwatch
                                        value={newColor}
                                        onChange={setNewColor}
                                        disabled={processing}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <Input
                                            ref={addInputRef}
                                            value={newTitle}
                                            onChange={(event) => setNewTitle(event.target.value)}
                                            placeholder="Stage name"
                                            disabled={processing}
                                            onKeyDown={(event) => {
                                                if (event.key === "Escape") {
                                                    setAdding(false);
                                                    setNewTitle("");
                                                    setNewColor(DEFAULT_COLOR);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <IconButton
                                            type="submit"
                                            size="sm"
                                            variant="ghost"
                                            icon="check-line"
                                            aria-label="Create stage"
                                            disabled={processing || !newTitle.trim()}
                                        />
                                        <IconButton
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            icon="close-line"
                                            aria-label="Cancel"
                                            disabled={processing}
                                            onClick={() => {
                                                setAdding(false);
                                                setNewTitle("");
                                                setNewColor(DEFAULT_COLOR);
                                            }}
                                        />
                                    </div>
                                </form>
                            ) : (
                                <button
                                    type="button"
                                    disabled={processing}
                                    onClick={() => setAdding(true)}
                                    className={cn(
                                        "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors",
                                        "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
                                        "disabled:pointer-events-none disabled:opacity-50"
                                    )}
                                >
                                    <Icon name="add-line" className="text-base" />
                                    Add Stage
                                </button>
                            )}
                        </div>
                    </DndProvider>
                </section>

                <LeadActionTypesSection
                    kind="activity"
                    propKey="activityActionTypes"
                    title="Lead Actions"
                    description="Activity types used when logging an update on a lead — drag to reorder."
                    items={activityActionTypes}
                />

                <LeadActionTypesSection
                    kind="next_action"
                    propKey="nextActionTypes"
                    title="What's Next Actions"
                    description="Next-action options for follow-ups — drag to reorder. The system “Do Nothing” item cannot be deleted."
                    items={nextActionTypes}
                />

                <section className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                            Pipe Rules
                        </h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Automation and defaults for this pipeline
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-xs">
                        <PipelineRulesPanel pipelineRules={pipelineRules} />
                    </div>
                </section>
        </div>
    );
}
