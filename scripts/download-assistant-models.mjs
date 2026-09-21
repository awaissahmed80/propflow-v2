#!/usr/bin/env node
/**
 * Downloads on-device assistant models into public/models (gitignored).
 *
 * Usage: node scripts/download-assistant-models.mjs
 *
 * Requires network access to huggingface.co
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelsRoot = path.join(root, "public", "models");

const MODELS = [
    {
        id: "Xenova/all-MiniLM-L6-v2",
        files: [
            "config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
            "onnx/model_quantized.onnx",
        ],
    },
];

async function download(repo, file, destination) {
    const url = `https://huggingface.co/${repo}/resolve/main/${file}`;
    const response = await fetch(url, {
        headers: { "User-Agent": "propflow-assistant-models/1.0" },
        redirect: "follow",
    });

    if (!response.ok) {
        throw new Error(`Failed ${url}: ${response.status}`);
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destination, buffer);
    console.log(`✓ ${repo}/${file} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
    for (const model of MODELS) {
        for (const file of model.files) {
            const destination = path.join(modelsRoot, model.id, file);
            await download(model.id, file, destination);
        }
    }

    console.log("\nDone. Intent model is ready under public/models.");
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
