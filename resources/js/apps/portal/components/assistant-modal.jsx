import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { store as storeLead } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/hooks/use-currency";
import { brief, interpret } from "@/routes/portal/assistant";
import { speechModelReady, startRecorder, transcribeRecording } from "./assistant-speech";

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

function csrfToken() {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);

    return match ? decodeURIComponent(match[1]) : "";
}

async function requestJson(url, method = "GET", body = null) {
    const response = await fetch(pathFrom(url), {
        method,
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "X-XSRF-TOKEN": csrfToken(),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        throw new Error("Request failed");
    }

    return response.json();
}

function speak(text) {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) {
        return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export function AssistantModal() {
    const { formatMoney } = useCurrency();
    const [open, setOpen] = useState(false);
    const [briefing, setBriefing] = useState(null);
    const [draft, setDraft] = useState("");
    const [transcript, setTranscript] = useState("");
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [recording, setRecording] = useState(false);
    const [recorder, setRecorder] = useState(null);
    const [speechReady, setSpeechReady] = useState(null);

    useEffect(() => {
        if (!open) {
            setRecorder((current) => {
                void current?.stop();

                return null;
            });
            setDraft("");
            setTranscript("");
            setResult(null);
            setRecording(false);

            return;
        }

        let cancelled = false;

        requestJson(brief.url())
            .then((payload) => {
                if (!cancelled) {
                    setBriefing(payload);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    toast.error("Could not load your brief");
                }
            });

        speechModelReady()
            .then((ready) => {
                if (!cancelled) {
                    setSpeechReady(ready);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setSpeechReady(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open]);

    const runTranscript = async (nextTranscript) => {
        const value = nextTranscript.trim();

        if (!value) {
            return;
        }

        setBusy(true);
        setTranscript(value);

        try {
            const payload = await requestJson(interpret.url(), "POST", { transcript: value });
            setResult(payload);
            speak(payload.prompt);

            if (payload.data && payload.intent && briefing) {
                setBriefing({ ...briefing, [payload.intent]: payload.data });
            }
        } catch {
            toast.error("Could not understand that");
        } finally {
            setBusy(false);
            setDraft("");
        }
    };

    const submitDraft = () => {
        const addition = draft.trim();

        if (!addition) {
            return;
        }

        const next = transcript ? `${transcript} ${addition}` : addition;
        runTranscript(next);
    };

    const toggleMic = async () => {
        if (!speechReady) {
            toast.error("Speech model is not installed on this server. Type instead.");
            return;
        }

        if (recording && recorder) {
            setBusy(true);

            try {
                const blob = await recorder.stop();
                setRecording(false);
                setRecorder(null);
                const text = blob ? await transcribeRecording(blob) : "";

                if (!text) {
                    toast.error("No speech heard");
                    return;
                }

                const next = transcript ? `${transcript} ${text}` : text;
                await runTranscript(next);
            } catch (error) {
                toast.error(error?.message || "Could not transcribe");
                setRecording(false);
                setRecorder(null);
            } finally {
                setBusy(false);
            }

            return;
        }

        try {
            const nextRecorder = startRecorder();
            await nextRecorder.start();
            setRecorder(nextRecorder);
            setRecording(true);
        } catch {
            toast.error("Microphone is unavailable");
        }
    };

    const saveLead = () => {
        const slots = result?.slots;

        if (!slots) {
            return;
        }

        setBusy(true);
        router.post(pathFrom(storeLead.url()), {
            contact: {
                first_name: slots.first_name,
                last_name: slots.last_name,
                phone_number: slots.phone_number,
                email_address: slots.email_address,
            },
            project_id: slots.project_id,
            budget: slots.budget,
            next_action: slots.next_action,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Lead created");
                setOpen(false);
                setResult(null);
                setTranscript("");
            },
            onError: (errors) => {
                toast.error(Object.values(errors)[0] || "Could not create the lead");
            },
            onFinish: () => setBusy(false),
        });
    };

    return (
        <>
            <IconButton
                size="sm"
                variant="outline"
                icon="mic-line"
                aria-label="Assistant"
                onClick={() => setOpen(true)}
            />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Assistant</DialogTitle>
                        <DialogDescription>
                            Ask for your work, progress, reminders, or start a lead.
                        </DialogDescription>
                    </DialogHeader>

                    {result?.prompt ? (
                        <p className="text-sm text-foreground">{result.prompt}</p>
                    ) : null}

                    {result?.intent === "create_lead" && result.missing?.length === 0 ? (
                        <ConfirmLead slots={result.slots} formatMoney={formatMoney} />
                    ) : null}

                    {result?.intent === "progress" && result.data ? (
                        <ProgressSummary progress={result.data} />
                    ) : null}

                    {result?.intent === "reminders" && Array.isArray(result.data) ? (
                        <ReminderList reminders={result.data} onOpen={() => setOpen(false)} />
                    ) : null}

                    {result?.intent === "work" && result.data ? (
                        <WorkList work={result.data} formatMoney={formatMoney} onOpen={() => setOpen(false)} />
                    ) : null}

                    {!result && briefing ? (
                        <div className="space-y-4">
                            <ProgressSummary progress={briefing.progress} />
                            <WorkList work={briefing.work} formatMoney={formatMoney} onOpen={() => setOpen(false)} />
                            <ReminderList reminders={briefing.reminders} onOpen={() => setOpen(false)} />
                        </div>
                    ) : null}

                    <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                            <Input
                                label="Instruction"
                                value={draft}
                                placeholder="What do I have today"
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        submitDraft();
                                    }
                                }}
                            />
                        </div>
                        <Button type="button" variant="outline" disabled={busy} onClick={toggleMic}>
                            <Icon name={recording ? "stop-circle-line" : "mic-line"} />
                        </Button>
                        <Button type="button" disabled={busy || !draft.trim()} onClick={submitDraft}>
                            Send
                        </Button>
                    </div>
                    {transcript ? (
                        <p className="text-xs text-muted-foreground">{transcript}</p>
                    ) : null}
                    {speechReady === false ? (
                        <p className="text-xs text-muted-foreground">
                            Speech model is not on this server yet. Type your request.
                        </p>
                    ) : null}

                    {result?.intent === "create_lead" && result.missing?.length === 0 ? (
                        <DialogFooter>
                            <Button type="button" disabled={busy} onClick={saveLead}>
                                Save lead
                            </Button>
                        </DialogFooter>
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}

function ProgressSummary({ progress }) {
    if (!progress) {
        return null;
    }

    return (
        <dl className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Open leads" value={progress.open_leads} />
            <Stat label="Overdue" value={progress.overdue} />
            <Stat label="Closed deals" value={progress.closed_deals} />
        </dl>
    );
}

function Stat({ label, value }) {
    return (
        <div className="rounded-lg border border-border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-base font-medium">{value ?? 0}</dd>
        </div>
    );
}

function WorkList({ work, formatMoney, onOpen }) {
    const leads = work?.leads ?? [];
    const tasks = work?.tasks ?? [];
    const installments = work?.installments ?? [];
    const empty = leads.length === 0 && tasks.length === 0 && installments.length === 0;

    if (empty) {
        return <p className="text-sm text-muted-foreground">Nothing due.</p>;
    }

    return (
        <ul className="space-y-2 text-sm">
            {leads.map((lead) => (
                <li key={lead.code}>
                    <button type="button" className="text-left hover:underline" onClick={() => visit(lead.href, onOpen)}>
                        {lead.name}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{lead.code}</span>
                        {lead.overdue ? <span className="ml-2 text-destructive">Overdue</span> : null}
                    </button>
                </li>
            ))}
            {tasks.map((task) => (
                <li key={`${task.lead_code}-${task.action}`}>
                    <button type="button" className="text-left hover:underline" onClick={() => visit(task.href, onOpen)}>
                        {task.action}
                        {task.lead_code ? (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{task.lead_code}</span>
                        ) : null}
                    </button>
                </li>
            ))}
            {installments.map((row) => (
                <li key={`${row.order_code}-${row.label}`}>
                    <button type="button" className="text-left hover:underline" onClick={() => visit(row.href, onOpen)}>
                        {row.label}
                        <span className="ml-2 text-muted-foreground">{formatMoney(row.amount)}</span>
                        {row.order_code ? (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{row.order_code}</span>
                        ) : null}
                    </button>
                </li>
            ))}
        </ul>
    );
}

function ReminderList({ reminders, onOpen }) {
    if (!reminders?.length) {
        return <p className="text-sm text-muted-foreground">No reminders.</p>;
    }

    return (
        <ul className="space-y-2 text-sm">
            {reminders.map((item) => (
                <li key={item.id}>
                    <button type="button" className="text-left hover:underline" onClick={() => visit(item.href, onOpen)}>
                        <span className="font-medium">{item.title}</span>
                        {item.body ? <span className="mt-0.5 block text-muted-foreground">{item.body}</span> : null}
                    </button>
                </li>
            ))}
        </ul>
    );
}

function ConfirmLead({ slots, formatMoney }) {
    return (
        <dl className="grid grid-cols-2 gap-2 text-sm">
            <Field label="Name" value={[slots.first_name, slots.last_name].filter(Boolean).join(" ")} />
            <Field label="Phone" value={slots.phone_number} />
            <Field label="Email" value={slots.email_address} />
            <Field label="Project" value={slots.project_code || slots.project_title} />
            <Field label="Budget" value={slots.budget != null ? formatMoney(slots.budget) : null} />
            <Field label="Next" value={slots.next_action} />
        </dl>
    );
}

function Field({ label, value }) {
    if (!value) {
        return null;
    }

    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
        </div>
    );
}

function visit(href, onOpen) {
    if (!href) {
        return;
    }

    onOpen?.();
    router.visit(href);
}
