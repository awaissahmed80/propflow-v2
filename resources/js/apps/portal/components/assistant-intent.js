import { configureTransformers, modelConfigExists } from "./assistant-transformers";

export const INTENT_MODEL_ID = "Xenova/all-MiniLM-L6-v2";

/** Minimum cosine similarity before we trust the on-device hint. */
export const INTENT_SCORE_THRESHOLD = 0.42;

/** Winner must beat runner-up by at least this margin. */
export const INTENT_SCORE_MARGIN = 0.04;

/**
 * Prototype phrases per CRM intent. The MiniLM embedding of the user text
 * is compared to these; the closest intent wins when confident enough.
 */
const INTENT_PROTOTYPES = {
    work: [
        "what do I have today",
        "show my work for today",
        "what should I do next",
        "any pending tasks or overdue items",
        "today's agenda and to-dos",
    ],
    progress: [
        "how is my progress",
        "show my stats and numbers",
        "how am I doing with leads",
        "my pipeline progress",
        "how many leads do I have",
        "total open leads",
        "lead count and stats",
    ],
    reminders: [
        "any reminders",
        "show my notifications",
        "do I have unread alerts",
        "check reminders",
    ],
    calendar: [
        "what is on my calendar",
        "do I have any events or appointments",
        "anything on my schedule this week",
        "upcoming meetings and site visits",
        "show my calendar",
    ],
    create_lead: [
        "create a new lead",
        "add a prospect",
        "capture a lead for someone",
        "start a new lead",
        "new lead with phone number",
    ],
    deals: [
        "show my deals",
        "my open orders and bookings",
        "list my deals",
    ],
    find_lead: [
        "find a lead by name",
        "search for a prospect",
        "look up who someone is",
        "find lead named",
    ],
    log_activity: [
        "log a call",
        "I just called a client",
        "record a meeting with a lead",
        "log that I met someone",
    ],
    clear_reminders: [
        "clear all reminders",
        "mark all notifications as read",
        "clear unread reminders",
    ],
    open: [
        "open contacts",
        "go to campaigns",
        "show inventory",
        "open the leads page",
        "take me to settings",
        "open dashboard",
    ],
    help: [
        "what can you help with",
        "show available commands",
        "help me with the assistant",
    ],
    greeting: [
        "hello how are you",
        "hi there",
        "good morning",
        "hey how is it going",
    ],
};

let extractorPromise = null;
let prototypeCachePromise = null;
let localModelPresent = null;

async function hasLocalIntentModel() {
    if (localModelPresent === null) {
        localModelPresent = await modelConfigExists(INTENT_MODEL_ID);
    }

    return localModelPresent;
}

/**
 * Preload MiniLM + prototype embeddings. Resolves true when usable.
 */
export async function warmIntentModel() {
    try {
        if (! await hasLocalIntentModel()) {
            return false;
        }

        const extractor = await loadExtractor();
        await loadPrototypeVectors(extractor);

        return true;
    } catch {
        return false;
    }
}

export async function intentModelReady() {
    return hasLocalIntentModel();
}

/**
 * @param {string} text
 * @returns {Promise<{ intent: string, score: number, margin: number } | null>}
 */
export async function classifyIntent(text) {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();

    if (cleaned.length < 2) {
        return null;
    }

    if (! await hasLocalIntentModel()) {
        return null;
    }

    try {
        const extractor = await loadExtractor();
        const prototypes = await loadPrototypeVectors(extractor);
        const query = await embed(extractor, cleaned);
        let best = null;
        let second = null;

        for (const [intent, vectors] of Object.entries(prototypes)) {
            let intentBest = -1;

            for (const vector of vectors) {
                const score = cosine(query, vector);

                if (score > intentBest) {
                    intentBest = score;
                }
            }

            const candidate = { intent, score: intentBest };

            if (!best || candidate.score > best.score) {
                second = best;
                best = candidate;
            } else if (!second || candidate.score > second.score) {
                second = candidate;
            }
        }

        if (!best) {
            return null;
        }

        const margin = best.score - (second?.score ?? 0);

        if (best.score < INTENT_SCORE_THRESHOLD || margin < INTENT_SCORE_MARGIN) {
            return null;
        }

        return {
            intent: best.intent,
            score: Number(best.score.toFixed(4)),
            margin: Number(margin.toFixed(4)),
        };
    } catch {
        return null;
    }
}

async function loadExtractor() {
    if (extractorPromise) {
        return extractorPromise;
    }

    extractorPromise = (async () => {
        const local = await hasLocalIntentModel();

        if (!local) {
            throw new Error("Intent model is not installed under public/models.");
        }

        const { pipeline } = await configureTransformers({ allowRemote: false });

        return pipeline("feature-extraction", INTENT_MODEL_ID, {
            dtype: "q8",
            device: "wasm",
        });
    })().catch((error) => {
        extractorPromise = null;
        throw error;
    });

    return extractorPromise;
}

async function loadPrototypeVectors(extractor) {
    if (prototypeCachePromise) {
        return prototypeCachePromise;
    }

    prototypeCachePromise = (async () => {
        const cached = {};

        for (const [intent, phrases] of Object.entries(INTENT_PROTOTYPES)) {
            cached[intent] = [];

            for (const phrase of phrases) {
                cached[intent].push(await embed(extractor, phrase));
            }
        }

        return cached;
    })().catch((error) => {
        prototypeCachePromise = null;
        throw error;
    });

    return prototypeCachePromise;
}

async function embed(extractor, text) {
    const output = await extractor(text, {
        pooling: "mean",
        normalize: true,
    });

    const data = output?.data ?? output;

    return Array.from(data);
}

function cosine(a, b) {
    const length = Math.min(a.length, b.length);
    let sum = 0;

    for (let index = 0; index < length; index += 1) {
        sum += a[index] * b[index];
    }

    return sum;
}
