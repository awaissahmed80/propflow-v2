import { useEffect, useState } from "react";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyPanel } from "./project-details-shared";

export function LocationMapPanel({ project, onSave }) {
    const mapSrc = project.map_embed_src || null;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(project.pin_location ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!editing) {
            setDraft(project.pin_location ?? "");
            setError(null);
        }
    }, [project.pin_location, editing]);

    const openEditor = () => {
        setDraft(project.pin_location ?? "");
        setError(null);
        setEditing(true);
    };

    const cancelEditor = () => {
        setDraft(project.pin_location ?? "");
        setError(null);
        setEditing(false);
    };

    const saveMap = () => {
        const pin_location = draft.trim() || null;

        if (pin_location === (project.pin_location || null)) {
            setEditing(false);
            return;
        }

        setSaving(true);
        setError(null);

        onSave(
            { pin_location },
            {
                onSuccess: () => {
                    setEditing(false);
                    setSaving(false);
                },
                onError: (errors) => {
                    setError(
                        errors.pin_location ||
                            errors.message ||
                            "Unable to save map embed"
                    );
                    setSaving(false);
                },
            }
        );
    };

    return (
        <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.12)] ring-border/60 dark:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.45)]">
            <CardHeader className="border-b border-border px-4 py-3 [.border-b]:pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Icon name="map-2-line" className="text-base text-muted-foreground" />
                    Location Map
                </CardTitle>
                {mapSrc && !editing ? (
                    <CardAction>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={openEditor}
                        >
                            Edit map
                        </Button>
                    </CardAction>
                ) : null}
                {editing ? (
                    <CardAction>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditor}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                    </CardAction>
                ) : null}
            </CardHeader>
            <CardContent className="p-0">
                {editing ? (
                    <div className="space-y-3 p-4">
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="project-map-embed"
                                className="text-sm font-medium text-muted-foreground"
                            >
                                Map embed
                            </Label>
                            <Textarea
                                id="project-map-embed"
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                placeholder="Paste Google Maps / OSM embed iframe code or map URL"
                                className="min-h-28 rounded-md font-mono text-xs dark:bg-input/30"
                                autoFocus
                            />
                            {error ? (
                                <p className="text-[13px] text-destructive">{error}</p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Use “Embed a map” from Google Maps, or paste an
                                    OpenStreetMap embed / share URL.
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                loading={saving}
                                onClick={saveMap}
                            >
                                Save map
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={saving}
                                onClick={cancelEditor}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : mapSrc ? (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                        <iframe
                            title={`${project.title} map`}
                            src={mapSrc}
                            className="size-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                        />
                    </div>
                ) : (
                    <EmptyPanel
                        icon="map-pin-line"
                        message="No map has been added."
                        action={
                            <button
                                type="button"
                                className="text-sm font-medium text-primary hover:underline"
                                onClick={openEditor}
                            >
                                Add map embed
                            </button>
                        }
                    />
                )}
            </CardContent>
        </Card>
    );
}
