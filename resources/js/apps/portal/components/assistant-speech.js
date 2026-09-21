import { configureTransformers, modelConfigExists } from "./assistant-transformers";

const MODEL_ID = "Xenova/whisper-tiny";
const SAMPLE_RATE = 16000;

let transcriberPromise = null;

export async function speechModelReady() {
    return modelConfigExists(MODEL_ID);
}

export async function transcribeRecording(blob) {
    const audio = await decodeToMono16k(blob);
    const transcriber = await loadTranscriber();
    const result = await transcriber(audio, { language: "english" });
    const text = typeof result?.text === "string" ? result.text.trim() : "";

    return text.replace(/\s+/g, " ").trim();
}

async function loadTranscriber() {
    if (transcriberPromise) {
        return transcriberPromise;
    }

    transcriberPromise = (async () => {
        const ready = await speechModelReady();

        if (!ready) {
            throw new Error("Speech model is not installed on this server. Type instead.");
        }

        const { pipeline } = await configureTransformers({ allowRemote: false });

        return pipeline("automatic-speech-recognition", MODEL_ID, {
            dtype: "q8",
            device: "wasm",
        });
    })().catch((error) => {
        transcriberPromise = null;
        throw error;
    });

    return transcriberPromise;
}

async function decodeToMono16k(blob) {
    const context = new AudioContext();
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const channel = decoded.getChannelData(0);
    const mono = decoded.sampleRate === SAMPLE_RATE
        ? channel
        : resample(channel, decoded.sampleRate, SAMPLE_RATE);

    await context.close();

    return mono;
}

function resample(input, fromRate, toRate) {
    if (fromRate === toRate) {
        return input;
    }

    const ratio = fromRate / toRate;
    const length = Math.round(input.length / ratio);
    const output = new Float32Array(length);

    for (let index = 0; index < length; index += 1) {
        const position = index * ratio;
        const left = Math.floor(position);
        const right = Math.min(left + 1, input.length - 1);
        const weight = position - left;
        output[index] = input[left] * (1 - weight) + input[right] * weight;
    }

    return output;
}

export function startRecorder() {
    let recorder = null;
    let stream = null;
    const chunks = [];

    return {
        async start() {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            recorder = new MediaRecorder(stream);
            recorder.addEventListener("dataavailable", (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            });
            recorder.start();
        },
        async stop() {
            if (!recorder) {
                return null;
            }

            const blob = await new Promise((resolve) => {
                recorder.addEventListener("stop", () => {
                    resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
                }, { once: true });
                recorder.stop();
            });

            stream?.getTracks().forEach((track) => track.stop());
            recorder = null;
            stream = null;

            return blob;
        },
    };
}
