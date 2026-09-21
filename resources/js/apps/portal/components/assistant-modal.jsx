import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { store as storeLead } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { store as storeLeadTask } from "@/actions/App/Http/Controllers/Portal/LeadTaskController";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
    Message,
    MessageAvatar,
    MessageContent,
} from "@/components/ui/message";
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { brief, interpret } from "@/routes/portal/assistant";
import { readAll as readAllNotifications } from "@/routes/portal/notifications";
import { speechModelReady, startRecorder, transcribeRecording } from "./assistant-speech";
import { classifyIntent, warmIntentModel } from "./assistant-intent";

const ACTIONS = [
    { id: "work", label: "Today's work", text: "what do I have today", icon: "checkbox-circle-line" },
    { id: "progress", label: "Lead stats", text: "how many leads do I have", icon: "line-chart-line" },
    { id: "reminders", label: "Reminders", text: "any reminders", icon: "notification-3-line" },
    { id: "calendar", label: "Calendar", text: "my calendar", icon: "calendar-event-line" },
    { id: "create_lead", label: "New lead", text: "new lead", icon: "user-add-line" },
    { id: "deals", label: "My deals", text: "my deals", icon: "handshake-line" },
    { id: "find_lead", label: "Find a lead", text: "find a lead", icon: "search-eye-line" },
    { id: "log_activity", label: "Log a call", text: "log a call", icon: "phone-line" },
    { id: "clear_reminders", label: "Clear reminders", text: "clear reminders", icon: "check-double-line" },
    { id: "leads", label: "Leads", text: "open leads", icon: "customer-service-line" },
    { id: "contacts", label: "Contacts", text: "open contacts", icon: "contacts-book-line" },
    { id: "campaigns", label: "Campaigns", text: "open campaigns", icon: "megaphone-line" },
    { id: "inventory", label: "Inventory", text: "open inventory", icon: "building-2-line" },
];

const assistantSession = {
    open: false,
    messages: [],
    draft: "",
    pendingContext: null,
    nextId: 0,
    speechReady: null,
};

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

function isFreshCommand(text) {
    return /\b(?:what do i have|what should i|my work|today(?:'s)? work|to-?dos?|pending|overdue|anything due|agenda|my progress|how am i|how many leads|lead(?:s)? (?:count|stats?|total)|total leads|reminders?|notifications?|alerts?|new lead|create lead|add lead|start lead|add (?:a )?prospect|lead for|calendars?|events?|schedule|appointments?|my deals|my orders|find (?:a )?lead|search|look up|who(?:'s| is)|open |show |go to |clear reminders|mark (?:them |all )?read|log (?:a )?(?:call|meeting)|i called|help|what can you|how are you|hello|hi|hey)\b/i.test(text);
}

function greetingFrom(payload) {
    const open = payload?.progress?.open_leads ?? 0;
    const overdue = payload?.progress?.overdue ?? 0;
    const due = (payload?.work?.leads?.length ?? 0)
        + (payload?.work?.tasks?.length ?? 0)
        + (payload?.work?.installments?.length ?? 0);

    if (!payload?.progress) {
        return "What would you like to do?";
    }

    return `You have ${open} open leads, ${due} due, and ${overdue} overdue. What would you like to do?`;
}

export function AssistantModal() {
    const { formatMoney } = useCurrency();
    const [open, setOpen] = useState(() => assistantSession.open);
    const [messages, setMessages] = useState(() => assistantSession.messages);
    const [draft, setDraft] = useState(() => assistantSession.draft);
    const [busy, setBusy] = useState(false);
    const [replying, setReplying] = useState(false);
    const [recording, setRecording] = useState(false);
    const [recorder, setRecorder] = useState(null);
    const [speechReady, setSpeechReady] = useState(() => assistantSession.speechReady);
    const [intentReady, setIntentReady] = useState(null);
    const pendingContext = useRef(assistantSession.pendingContext);
    const idRef = useRef(assistantSession.nextId);
    const bootstrapped = useRef(assistantSession.messages.length > 0);

    const nextId = () => {
        idRef.current += 1;
        assistantSession.nextId = idRef.current;

        return idRef.current;
    };

    useEffect(() => {
        assistantSession.open = open;
    }, [open]);

    useEffect(() => {
        assistantSession.messages = messages;
    }, [messages]);

    useEffect(() => {
        assistantSession.draft = draft;
    }, [draft]);

    useEffect(() => {
        assistantSession.pendingContext = pendingContext.current;
    }, [messages, open]);

    useEffect(() => {
        assistantSession.speechReady = speechReady;
    }, [speechReady]);

    useEffect(() => {
        if (!open) {
            setRecorder((current) => {
                void current?.stop();

                return null;
            });
            setDraft("");
            setMessages([]);
            setRecording(false);
            setBusy(false);
            setReplying(false);
            pendingContext.current = null;
            assistantSession.pendingContext = null;
            assistantSession.messages = [];
            assistantSession.draft = "";
            bootstrapped.current = false;

            return;
        }

        let cancelled = false;

        if (assistantSession.messages.length === 0) {
            const greetingId = nextId();
            const greeting = [{
                id: greetingId,
                role: "assistant",
                text: greetingFrom(null),
                options: ACTIONS,
            }];

            assistantSession.messages = greeting;
            setMessages(greeting);
            bootstrapped.current = true;

            requestJson(brief.url())
                .then((payload) => {
                    if (cancelled) {
                        return;
                    }

                    setMessages((current) => {
                        if (current.length !== 1 || current[0]?.role !== "assistant") {
                            return current;
                        }

                        const next = [{ ...current[0], text: greetingFrom(payload) }];
                        assistantSession.messages = next;

                        return next;
                    });
                })
                .catch(() => {
                    if (!cancelled) {
                        toast.error("Could not load your brief");
                    }
                });
        } else {
            bootstrapped.current = true;
        }

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

        warmIntentModel()
            .then((ready) => {
                if (!cancelled) {
                    setIntentReady(ready);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setIntentReady(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open]);

    const sendText = async (addition) => {
        const text = addition.trim();

        if (!text || replying) {
            return;
        }

        setMessages((current) => [...current, { id: nextId(), role: "user", text }]);
        setDraft("");
        setReplying(true);

        const body = { transcript: text };

        if (pendingContext.current && !isFreshCommand(text)) {
            body.context = pendingContext.current;
        } else {
            const classified = await classifyIntent(text);

            if (classified) {
                body.intent_hint = classified.intent;
                body.intent_score = classified.score;
            }
        }

        try {
            const payload = await requestJson(interpret.url(), "POST", body);

            if (payload.missing?.length) {
                pendingContext.current = {
                    intent: payload.intent,
                    slots: payload.slots || {},
                    missing: payload.missing,
                };
            } else {
                pendingContext.current = null;
            }

            setMessages((current) => [...current, {
                id: nextId(),
                role: "assistant",
                text: payload.prompt,
                payload,
            }]);
        } catch {
            pendingContext.current = null;
            setMessages((current) => [...current, {
                id: nextId(),
                role: "assistant",
                text: "I couldn't understand that. Try again.",
            }]);
        } finally {
            setReplying(false);
        }
    };

    const toggleMic = async () => {
        if (speechReady === false) {
            toast.error("Speech model is not installed on this server. Type instead.");
            return;
        }

        if (recording && recorder) {
            setReplying(true);

            try {
                const blob = await recorder.stop();
                setRecording(false);
                setRecorder(null);
                const text = blob ? await transcribeRecording(blob) : "";

                if (!text) {
                    toast.error("No speech heard");
                    return;
                }

                await sendText(text);
            } catch (error) {
                toast.error(error?.message || "Could not transcribe");
                setRecording(false);
                setRecorder(null);
            } finally {
                setReplying(false);
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

    const saveLead = (message) => {
        const slots = message.payload?.slots;

        if (!slots || message.saved) {
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
                pendingContext.current = null;
                setMessages((current) => [
                    ...current.map((item) => (item.id === message.id ? { ...item, saved: true } : item)),
                    {
                        id: nextId(),
                        role: "assistant",
                        text: "Saved. The lead is assigned to you.",
                        payload: { ask: "What would you like to do?", options: ACTIONS },
                    },
                ]);
                toast.success("Lead created");
            },
            onError: (errors) => {
                toast.error(Object.values(errors)[0] || "Could not create the lead");
            },
            onFinish: () => setBusy(false),
        });
    };

    const clearReminders = async (message) => {
        if (message.saved) {
            return;
        }

        setBusy(true);

        try {
            await requestJson(readAllNotifications.url(), "POST");
            pendingContext.current = null;
            setMessages((current) => [
                ...current.map((item) => (item.id === message.id ? { ...item, saved: true } : item)),
                {
                    id: nextId(),
                    role: "assistant",
                    text: "Reminders cleared.",
                    payload: { ask: "What would you like to do?", options: ACTIONS },
                },
            ]);
            toast.success("Reminders cleared");
        } catch {
            toast.error("Could not clear reminders");
        } finally {
            setBusy(false);
        }
    };

    const saveActivity = (message) => {
        const slots = message.payload?.slots;

        if (!slots?.lead_code || message.saved) {
            return;
        }

        const due = new Date();
        due.setDate(due.getDate() + 1);

        setBusy(true);
        router.post(pathFrom(storeLeadTask.url(slots.lead_code)), {
            action: slots.action,
            comments: slots.comments || "Logged from assistant",
            next_action: slots.next_action || "Follow-up",
            due_date: due.toISOString().slice(0, 10),
        }, {
            preserveScroll: true,
            onSuccess: () => {
                pendingContext.current = null;
                setMessages((current) => [
                    ...current.map((item) => (item.id === message.id ? { ...item, saved: true } : item)),
                    {
                        id: nextId(),
                        role: "assistant",
                        text: `Logged ${slots.action} for ${slots.lead_name || slots.lead_code}.`,
                        payload: { ask: "What would you like to do?", options: ACTIONS },
                    },
                ]);
                toast.success("Activity logged");
            },
            onError: (errors) => {
                toast.error(Object.values(errors)[0] || "Could not log the activity");
            },
            onFinish: () => setBusy(false),
        });
    };

    const confirmMessage = (message) => {
        if (message.payload?.intent === "create_lead") {
            saveLead(message);
            return;
        }

        if (message.payload?.intent === "clear_reminders") {
            clearReminders(message);
            return;
        }

        if (message.payload?.intent === "log_activity") {
            saveActivity(message);
        }
    };

    return (
        <>
            <button
                type="button"
                aria-label={open ? "Close assistant" : "Open assistant"}
                aria-expanded={open}
                className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-2.5 text-xs font-semibold text-slate-50 shadow-xs outline-none transition",
                    "hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-ring",
                    "dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
                    open && "ring-2 ring-slate-500/60 dark:ring-slate-300/70",
                )}
                onClick={() => setOpen((current) => !current)}
            >
                <span
                    className={cn(
                        "size-2 shrink-0 rounded-full",
                        open
                            ? "bg-emerald-400 dark:bg-emerald-600"
                            : "bg-sky-400 dark:bg-primary",
                    )}
                />
                <span>Assistant</span>
            </button>

            {open ? (
                <section
                    aria-label="Assistant chat"
                    className="fixed right-3 bottom-3 z-50 flex h-[min(32rem,calc(100dvh-5.5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md"
                >
                    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-card px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Icon name="sparkling-2-fill" className="text-sm" />
                                <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-chart-1 ring-2 ring-card" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="truncate text-base font-bold tracking-tight text-foreground">Assistant</h2>
                                <p className="truncate text-xs text-muted-foreground">
                                    {intentReady
                                        ? "On-device intent ready"
                                        : "Ask about work, leads, deals"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            aria-label="Close assistant"
                            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            onClick={() => setOpen(false)}
                        >
                            <Icon name="close-line" className="text-base" />
                        </button>
                    </header>

                    <MessageScrollerProvider
                        autoScroll
                        defaultScrollPosition="last-anchor"
                        scrollPreviousItemPeek={48}
                    >
                        <MessageScroller className="min-h-0 flex-1 bg-background">
                            <MessageScrollerViewport className="px-3 py-3">
                                <MessageScrollerContent>
                                    {messages.map((message) => (
                                        <MessageScrollerItem
                                            key={message.id}
                                            messageId={String(message.id)}
                                            scrollAnchor={message.role === "user"}
                                        >
                                            <ChatMessage
                                                message={message}
                                                formatMoney={formatMoney}
                                                busy={busy || replying}
                                                onChoose={sendText}
                                                onConfirm={() => confirmMessage(message)}
                                            />
                                        </MessageScrollerItem>
                                    ))}
                                    {replying ? (
                                        <MessageScrollerItem messageId="assistant-thinking">
                                            <Message align="start">
                                                <MessageAvatar className="size-7 bg-primary text-primary-foreground">
                                                    <Icon name="sparkling-2-fill" className="text-xs" />
                                                </MessageAvatar>
                                                <MessageContent className="max-w-[85%]">
                                                    <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                                                        <span className="flex gap-1">
                                                            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
                                                            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:120ms]" />
                                                            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:240ms]" />
                                                        </span>
                                                        Thinking…
                                                    </div>
                                                </MessageContent>
                                            </Message>
                                        </MessageScrollerItem>
                                    ) : null}
                                </MessageScrollerContent>
                            </MessageScrollerViewport>
                            <MessageScrollerButton />
                        </MessageScroller>
                    </MessageScrollerProvider>

                    <form
                        className="shrink-0 border-t border-border bg-card p-2.5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            sendText(draft);
                        }}
                    >
                        <div className="flex items-end gap-1.5">
                            <div className="min-w-0 flex-1">
                                <Input
                                    aria-label="Message"
                                    value={draft}
                                    placeholder="Ask or type a command…"
                                    onChange={(event) => setDraft(event.target.value)}
                                />
                            </div>
                            <Button
                                type="button"
                                variant={recording ? "destructive" : "outline"}
                                size="icon"
                                className={cn("shrink-0", recording && "animate-pulse")}
                                disabled={replying && !recording}
                                onClick={toggleMic}
                                aria-label={recording ? "Stop" : "Speak"}
                            >
                                <Icon name={recording ? "stop-circle-line" : "mic-line"} />
                            </Button>
                            <Button
                                type="submit"
                                size="icon"
                                className="shrink-0"
                                disabled={replying || busy || !draft.trim()}
                                aria-label="Send"
                            >
                                <Icon name="send-plane-2-fill" />
                            </Button>
                        </div>
                        {speechReady === false ? (
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Icon name="information-line" className="text-sm" />
                                Speech model is not on this server yet. Type your request.
                            </p>
                        ) : null}
                    </form>
                </section>
            ) : null}
        </>
    );
}

function ChatMessage({ message, formatMoney, busy, onChoose, onConfirm }) {
    const mine = message.role === "user";
    const payload = message.payload;
    const options = payload?.options?.length ? payload.options : message.options;
    const waiting = Array.isArray(payload?.missing) && payload.missing.length > 0;
    const canConfirm = Boolean(payload?.confirm || (payload?.intent === "create_lead" && !waiting && payload.slots));

    return (
        <Message align={mine ? "end" : "start"}>
            {!mine ? (
                <MessageAvatar className="size-7 bg-primary text-primary-foreground">
                    <Icon name="sparkling-2-fill" className="text-xs" />
                </MessageAvatar>
            ) : null}
            <MessageContent className={mine ? "max-w-[88%] items-end" : "max-w-[94%]"}>
                <div
                    className={cn(
                        mine
                            ? "rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                            : "rounded-2xl rounded-bl-md border border-border bg-muted px-3 py-2 text-sm text-foreground",
                    )}
                >
                    <p>{message.text}</p>
                    {payload?.intent === "create_lead" && !waiting ? (
                        <div className="mt-2 rounded-lg border border-border bg-background/60 p-2">
                            <ConfirmLead slots={payload.slots} formatMoney={formatMoney} />
                        </div>
                    ) : null}
                    {payload?.intent === "log_activity" && payload.confirm ? (
                        <dl className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-background/60 p-2 text-sm">
                            <Field label="Lead" value={payload.slots?.lead_name || payload.slots?.query} />
                            <Field label="Action" value={payload.slots?.action} />
                            <Field label="Next" value={payload.slots?.next_action} />
                        </dl>
                    ) : null}
                    {payload?.intent === "progress" && payload.data ? (
                        <div className="mt-2">
                            <ProgressSummary progress={payload.data} />
                        </div>
                    ) : null}
                    {payload?.intent === "reminders" && Array.isArray(payload.data) ? (
                        <div className="mt-2">
                            <ReminderList reminders={payload.data} />
                        </div>
                    ) : null}
                    {payload?.intent === "work" && payload.data ? (
                        <div className="mt-2">
                            <WorkList work={payload.data} formatMoney={formatMoney} />
                        </div>
                    ) : null}
                    {payload?.intent === "calendar" && Array.isArray(payload.data) ? (
                        <div className="mt-2">
                            <EventList events={payload.data} />
                        </div>
                    ) : null}
                    {payload?.intent === "deals" && Array.isArray(payload.data) ? (
                        <div className="mt-2">
                            <DealList deals={payload.data} />
                        </div>
                    ) : null}
                    {(payload?.intent === "find_lead" || payload?.intent === "log_activity") && Array.isArray(payload.data) ? (
                        <div className="mt-2">
                            <LeadMatchList
                                leads={payload.data}
                                onPick={waiting ? onChoose : null}
                            />
                        </div>
                    ) : null}
                    {payload?.intent === "open" && payload.slots?.href ? (
                        <Button type="button" size="sm" className="mt-2 gap-1.5" onClick={() => visit(payload.slots.href)}>
                            <Icon name="external-link-line" />
                            Go to {payload.slots.label}
                        </Button>
                    ) : null}
                    {canConfirm && !message.saved ? (
                        <Button type="button" size="sm" className="mt-2 gap-1.5" disabled={busy} onClick={onConfirm}>
                            <Icon name={payload.intent === "clear_reminders" ? "check-double-line" : "save-line"} />
                            {payload.intent === "clear_reminders" ? "Clear reminders" : payload.intent === "log_activity" ? "Save update" : "Save lead"}
                        </Button>
                    ) : null}
                </div>
                {!mine && payload?.ask ? (
                    <p className="px-1 text-xs text-muted-foreground">{payload.ask}</p>
                ) : null}
                {!mine && options?.length ? (
                    <div className="flex flex-wrap gap-1.5 px-1">
                        {options.map((option) => {
                            const meta = ACTIONS.find((action) => action.id === option.id) || option;

                            return (
                                <button
                                    key={option.id || option.text}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => onChoose(option.text)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                                >
                                    {meta.icon ? <Icon name={meta.icon} className="text-sm text-muted-foreground" /> : null}
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                ) : null}
            </MessageContent>
        </Message>
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
        <div className="rounded-lg border border-border bg-background px-2 py-1.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-base font-semibold text-foreground">{value ?? 0}</dd>
        </div>
    );
}

function WorkList({ work, formatMoney }) {
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
                    <button type="button" className="text-left hover:underline" onClick={() => visit(lead.href)}>
                        {lead.name}
                        {lead.overdue ? <span className="ml-2 text-destructive">Overdue</span> : null}
                    </button>
                </li>
            ))}
            {tasks.map((task) => (
                <li key={`${task.lead_code}-${task.action}`}>
                    <button type="button" className="text-left hover:underline" onClick={() => visit(task.href)}>
                        {task.action}
                    </button>
                </li>
            ))}
            {installments.map((row) => (
                <li key={`${row.order_code}-${row.label}`}>
                    <button type="button" className="text-left hover:underline" onClick={() => visit(row.href)}>
                        {row.label}
                        <span className="ml-2 text-muted-foreground">{formatMoney(row.amount)}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

function EventList({ events }) {
    if (!events.length) {
        return <p className="text-sm text-muted-foreground">Nothing scheduled.</p>;
    }

    return (
        <ul className="space-y-2 text-sm">
            {events.map((event) => (
                <li key={`${event.code}-${event.when}`}>
                    <button type="button" className="text-left hover:underline" onClick={() => visit(event.href)}>
                        {event.name}
                        {event.action ? <span className="ml-2 text-muted-foreground">{event.action}</span> : null}
                        {event.overdue ? <span className="ml-2 text-destructive">Overdue</span> : null}
                    </button>
                </li>
            ))}
        </ul>
    );
}

function DealList({ deals }) {
    if (!deals.length) {
        return <p className="text-sm text-muted-foreground">No open deals.</p>;
    }

    return (
        <ul className="space-y-2 text-sm">
            {deals.map((deal) => (
                <li key={deal.code}>
                    <button type="button" className="text-left hover:underline" onClick={() => visit(deal.href)}>
                        {deal.name}
                        <span className="ml-2 capitalize text-muted-foreground">{deal.status}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

function LeadMatchList({ leads, onPick }) {
    if (!leads.length) {
        return <p className="text-sm text-muted-foreground">No matching leads.</p>;
    }

    return (
        <ul className="space-y-2 text-sm">
            {leads.map((lead) => (
                <li key={lead.code}>
                    <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => (onPick ? onPick(lead.name) : visit(lead.href))}
                    >
                        {lead.name}
                    </button>
                </li>
            ))}
        </ul>
    );
}

function ReminderList({ reminders }) {
    if (!reminders?.length) {
        return <p className="text-sm text-muted-foreground">No reminders.</p>;
    }

    return (
        <ul className="space-y-2 text-sm">
            {reminders.map((item) => (
                <li key={item.id}>
                    <button type="button" className="text-left hover:underline" onClick={() => visit(item.href)}>
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

function visit(href) {
    if (!href) {
        return;
    }

    router.visit(href);
}
