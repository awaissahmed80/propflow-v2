import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { store as storeOrderActivity } from "@/actions/App/Http/Controllers/Portal/OrderActivityController";
import { FileManagerPicker } from "@/components/file-manager-picker";
import { FilePreview } from "@/components/file-preview";
import { VoiceNoteRecorder } from "@/components/voice-note-recorder";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";
import { uploadLibraryFile } from "@/lib/assets";
import { cn } from "@/lib/utils";
import {
    activityIconStyle,
    NOTE_ACTION,
    NOTE_PLACEHOLDER,
} from "./booking-activity-timeline";

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            return new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname || "/";
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

export function NoteComposer({ orderCode, locked = false }) {
    const [expanded, setExpanded] = useState(false);
    const [notes, setNotes] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [voiceOpen, setVoiceOpen] = useState(false);
    const [voiceDraft, setVoiceDraft] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setExpanded(false);
        setNotes("");
        setAttachments([]);
        setPickerOpen(false);
        setVoiceOpen(false);
        setVoiceDraft(null);
        setPreviewOpen(false);
        setSubmitting(false);
    };

    useEffect(() => {
        reset();
    }, [orderCode]);

    const submitNote = async () => {
        const comments = notes.trim() || (voiceDraft?.file ? "Voice note" : "");

        if (locked || !comments || submitting) {
            return;
        }

        setSubmitting(true);

        try {
            let mediaIds = attachments
                .filter((file) => file.kind === "media")
                .map((file) => file.id);
            const documentIds = attachments
                .filter((file) => file.kind === "document")
                .map((file) => file.id);

            if (voiceDraft?.file) {
                const uploaded = await uploadLibraryFile("media", voiceDraft.file);
                mediaIds = [...mediaIds, uploaded.id];
            }

            router.post(
                pathFrom(storeOrderActivity.url(orderCode)),
                {
                    action: NOTE_ACTION,
                    comments,
                    media_ids: mediaIds,
                    document_ids: documentIds,
                },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success("Note added");
                        reset();
                    },
                    onError: (errors) => {
                        toast.error(errors.comments || errors.action || "Could not save note");
                        setSubmitting(false);
                    },
                    onFinish: () => setSubmitting(false),
                },
            );
        } catch (error) {
            toast.error(error?.message || "Could not upload voice note");
            setSubmitting(false);
        }
    };

    if (locked) {
        return (
            <div className="shrink-0 border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
                Notes are paused on closed bookings.
            </div>
        );
    }

    if (!expanded) {
        return (
            <div className="shrink-0  border-t border-border bg-linear-to-t from-primary/8 to-transparent px-4 py-4">
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className={cn(
                        "group cursor-pointer flex w-full items-center gap-3 rounded-xl border border-primary/35 bg-primary/10 px-4 py-3.5 text-left shadow-[0_10px_30px_-18px_rgba(56,71,208,0.55)]",
                        "transition-all duration-200 hover:border-primary/55 hover:bg-primary/15 hover:shadow-[0_14px_36px_-16px_rgba(56,71,208,0.65)]",
                        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    )}
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
                        <Icon name="add-line" className="text-xl" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-base font-bold tracking-tight text-foreground">
                            Add a note
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted-foreground group-hover:text-foreground/80">
                            {NOTE_PLACEHOLDER}
                        </span>
                    </span>
                    
                </button>
            </div>
        );
    }

    return (
        <div className="shrink-0 space-y-3 border-t border-primary/25 bg-primary/[0.04] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                    <span
                        className="flex size-8 items-center justify-center rounded-full"
                        style={activityIconStyle("#64748B")}
                        aria-hidden
                    >
                        <Icon name="sticky-note-line" className="text-sm" />
                    </span>
                    <span className="font-semibold text-foreground">Add a Note</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="mic-line"
                        aria-label="Record voice note"
                        aria-pressed={voiceOpen}
                        onClick={() => setVoiceOpen((current) => !current)}
                    />
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="attachment-2"
                        aria-label="Attach file"
                        onClick={() => setPickerOpen(true)}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={reset}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        loading={submitting}
                        disabled={!notes.trim() && !voiceDraft?.file}
                        onClick={submitNote}
                    >
                        Submit
                    </Button>
                </div>
            </div>

            {voiceOpen ? (
                <VoiceNoteRecorder
                    open={voiceOpen}
                    onChange={(draft) => {
                        setVoiceDraft(draft);

                        if (!draft) {
                            setVoiceOpen(false);
                        }
                    }}
                    onCancel={() => {
                        setVoiceDraft(null);
                        setVoiceOpen(false);
                    }}
                />
            ) : null}

            {!voiceOpen || voiceDraft ? (
                <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={NOTE_PLACEHOLDER}
                    rows={3}
                    autoFocus={!voiceOpen}
                    className="min-h-20 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
            ) : null}

            {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {attachments.map((file, fileIndex) => {
                        const image =
                            file.kind === "media" ||
                            String(file.type || "").startsWith("image/");

                        return (
                            <span
                                key={`${file.kind}-${file.id}`}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background py-1 pr-1 pl-1.5 text-xs text-foreground"
                            >
                                <button
                                    type="button"
                                    className="inline-flex min-w-0 items-center gap-1.5"
                                    aria-label={`Preview ${file.name || "file"}`}
                                    onClick={() => {
                                        setPreviewIndex(fileIndex);
                                        setPreviewOpen(true);
                                    }}
                                >
                                    {image && (file.thumbnail_url || file.url) ? (
                                        <img
                                            src={file.thumbnail_url || file.url}
                                            alt=""
                                            className="size-8 rounded-sm object-cover"
                                        />
                                    ) : (
                                        <Icon
                                            name="file-text-line"
                                            className="shrink-0 text-sm text-muted-foreground"
                                        />
                                    )}
                                    <span className="max-w-40 truncate">{file.name}</span>
                                </button>
                                <IconButton
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    icon="close-line"
                                    aria-label="Remove attachment"
                                    onClick={() =>
                                        setAttachments((current) =>
                                            current.filter(
                                                (item) =>
                                                    !(item.id === file.id && item.kind === file.kind),
                                            ),
                                        )
                                    }
                                />
                            </span>
                        );
                    })}
                </div>
            ) : null}

            <FilePreview
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                files={attachments}
                index={previewIndex}
                onIndexChange={setPreviewIndex}
            />
            <FileManagerPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                value={attachments}
                onApply={setAttachments}
            />
        </div>
    );
}
