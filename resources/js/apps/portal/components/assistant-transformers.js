const WASM_BASE = "/models/onnxruntime/";

function localWasmSuffix() {
    const agent = navigator.userAgent;
    const safari = /Safari/i.test(agent) && !/Chrome|Chromium|Edg/i.test(agent);
    const version = Number((agent.match(/Version\/(\d+)/) || [])[1] || 0);

    return safari && version > 0 && version < 26 ? "" : ".asyncify";
}

/**
 * Configure @huggingface/transformers for this app's /models assets.
 *
 * @param {{ allowRemote?: boolean }} [options]
 */
export async function configureTransformers(options = {}) {
    const { pipeline, env } = await import("@huggingface/transformers");
    const wasmSuffix = localWasmSuffix();
    const allowRemote = Boolean(options.allowRemote);

    env.allowRemoteModels = allowRemote;
    env.allowLocalModels = true;
    env.localModelPath = "/models/";

    if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.wasmPaths = {
            mjs: `${WASM_BASE}ort-wasm-simd-threaded${wasmSuffix}.mjs`,
            wasm: `${WASM_BASE}ort-wasm-simd-threaded${wasmSuffix}.wasm`,
        };
    }

    return { pipeline, env };
}

export async function modelConfigExists(modelId) {
    try {
        const response = await fetch(`/models/${modelId}/config.json`, { method: "HEAD" });

        return response.ok;
    } catch {
        return false;
    }
}
