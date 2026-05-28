import {createOpenRouter} from "@openrouter/ai-sdk-provider"

export function getAgentModel() {
    const router = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY
    })

    const modelId = process.env.OPENROUTER_MODEL_ID || process.env.OPENROUTER_DEFAULT_MODEL;
    if (!modelId) {
        throw new Error("OPENROUTER_MODEL_ID or OPENROUTER_DEFAULT_MODEL environment variable is missing");
    }
    return router(modelId);
}

