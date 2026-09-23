import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { store as storeLeadTask } from "@/actions/App/Http/Controllers/Portal/LeadTaskController";
import { FileManagerPicker } from "@/components/file-manager-picker";
import { FilePreview } from "@/components/file-preview";
import { VoiceNoteRecorder } from "@/components/voice-note-recorder";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { DateTimePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { toDayjs } from "@/lib/datetime";
import { uploadLibraryFile } from "@/lib/assets";
import { cn } from "@/lib/utils";

const UPDATE_PLACEHOLDER =
    "Have you taken any steps on this lead? Record them here...";


function actionTitles(items = []) {
    return items
        .map((item) => (typeof item === "string" ? item : item?.title))
        .filter(Boolean);
}

function doNothingTitle(items = []) {
    const match = items.find((item) => item?.label === "do_nothing");

    return match?.title || "Do Nothing";
}




export function UpdateComposer({
    leadCode,
    activityTypes = [],
    nextActionTypes = [],
    locked = false,
}) {
    const activityTitles = useMemo(() => actionTitles(activityTypes), [activityTypes]);
    const nextTitles = useMemo(() => actionTitles(nextActionTypes), [nextActionTypes]);
    const noopTitle = useMemo(() => doNothingTitle(nextActionTypes), [nextActionTypes]);
    const defaultActivity = activityTitles[0] || "Note";
    const defaultNext = nextTitles[0] || noopTitle;

    const [expanded, setExpanded] = useState(false);
    const [activityType, setActivityType] = useState(defaultActivity);
    const [notes, setNotes] = useState("");
    const [nextActionType, setNextActionType] = useState(defaultNext);
    const [nextAt, setNextAt] = useState(() => new Date());
    const [attachments, setAttachments] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [voiceOpen, setVoiceOpen] = useState(false);
    const [voiceDraft, setVoiceDraft] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setExpanded(false);
        setActivityType(defaultActivity);
        setNotes("");
        setNextActionType(defaultNext);
        setNextAt(new Date());
        setAttachments([]);
        setPickerOpen(false);
        setVoiceOpen(false);
        setVoiceDraft(null);
        setPreviewOpen(false);
        setSubmitting(false);
    };

    const submitUpdate = async () => {
        if (locked) {
            toast.error("This lead is locked while its booking is active");
            return;
        }

        const comments = notes.trim() || (voiceDraft?.file ? "Voice note" : "");

        if (!comments || submitting) {
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
                storeLeadTask.url(leadCode),
                {
                    action: activityType,
                    comments,
                    next_action: nextActionType,
                    due_date:
                        nextActionType === noopTitle ? null : nextAt.toISOString(),
                    media_ids: mediaIds,
                    document_ids: documentIds,
                },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success("Update recorded");
                        reset();
                    },
                    onError: (errors) => {
                        toast.error(
                            errors.comments ||
                                errors.action ||
                                errors.due_date ||
                                errors.next_action ||
                                "Could not save update"
                        );
                        setSubmitting(false);
                    },
                    onFinish: () => setSubmitting(false),
                }
            );
        } catch (error) {
            toast.error(error?.message || "Could not upload voice note");
            setSubmitting(false);
        }
    };

    useEffect(() => {
        reset();
    }, [leadCode, defaultActivity, defaultNext]);

    if (!expanded) {
        if (locked) {
            return (
                <div className="shrink-0 border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
                    Updates are paused while the booking is active.
                </div>
            );
        }

        return (
            <div className="shrink-0 bg-background px-4 py-4">
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className={cn(
                        "group flex w-full items-center gap-3 rounded-xl border border-primary/35 bg-primary/10 px-4 py-3.5 text-left shadow-[0_10px_30px_-18px_rgba(56,71,208,0.55)]",
                        "transition-all duration-200 hover:border-primary/55 hover:bg-primary/15 hover:shadow-[0_14px_36px_-16px_rgba(56,71,208,0.65)]",
                        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    )}
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
                        <Icon name="add-line" className="text-xl" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-base font-bold tracking-tight text-foreground">
                            Log an update
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted-foreground group-hover:text-foreground/80">
                            {UPDATE_PLACEHOLDER}
                        </span>
                    </span>            
                </button>
            </div>
        );
    }

    return (
        <div className="shrink-0 space-y-3 border-t border-primary/25 bg-primary/4 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">What&apos;s Done</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1 font-medium transition-colors hover:bg-muted/70"
                                >
                                    {activityType}
                                    <Icon
                                        name="arrow-down-s-line"
                                        className="text-sm text-muted-foreground"
                                    />
                                </button>
                            }
                        />
                        <DropdownMenuContent align="start" className="w-auto min-w-40">
                            {activityTitles.map((type) => (
                                <DropdownMenuItem
                                    key={type}
                                    disabled={activityType === type}
                                    className="whitespace-nowrap"
                                    onClick={() => setActivityType(type)}
                                >
                                    {type}
                                    {activityType === type ? (
                                        <Icon
                                            name="check-line"
                                            className="ml-auto text-sm"
                                        />
                                    ) : null}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                        onClick={submitUpdate}
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
                    placeholder={UPDATE_PLACEHOLDER}
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
                                <button
                                    type="button"
                                    className="rounded-sm text-muted-foreground hover:text-foreground"
                                    aria-label={`Remove ${file.name}`}
                                    onClick={() =>
                                        setAttachments((current) =>
                                            current.filter(
                                                (item) =>
                                                    !(
                                                        item.kind === file.kind &&
                                                        item.id === file.id
                                                    )
                                            )
                                        )
                                    }
                                >
                                    <Icon name="close-line" className="text-sm" />
                                </button>
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

            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">What&apos;s Next?</span>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1 font-medium transition-colors hover:bg-muted/70"
                            >
                                {nextActionType}
                                <Icon
                                    name="arrow-down-s-line"
                                    className="text-sm text-muted-foreground"
                                />
                            </button>
                        }
                    />
                    <DropdownMenuContent align="start" className="w-auto min-w-40">
                        {nextTitles.map((type) => (
                            <DropdownMenuItem
                                key={type}
                                disabled={nextActionType === type}
                                className="whitespace-nowrap"
                                onClick={() => setNextActionType(type)}
                            >
                                {type}
                                {nextActionType === type ? (
                                    <Icon
                                        name="check-line"
                                        className="ml-auto text-sm"
                                    />
                                ) : null}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {nextActionType !== noopTitle ? (
                    <DateTimePicker
                        value={nextAt}
                        onChange={(value) => {
                            const next = toDayjs(value);
                            if (next) {
                                setNextAt(next.toDate());
                            }
                        }}
                        clearable={false}
                        side="top"
                        displayFormat="d MMM yyyy h:mm a"
                        className="w-auto"
                        triggerClassName="h-8 w-auto min-w-0 gap-2 border-border bg-muted/40 px-2.5 py-1 text-sm shadow-none dark:bg-muted/40 dark:hover:bg-muted/70"
                    />
                ) : null}
            </div>
        </div>
    );
}
