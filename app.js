const express = require("express");
const path = require("path");
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.static(__dirname));

// Sensitive API Keys kept on the backend
const APIs = {
    gemini: process.env.GEMINI_API,
    groq: process.env.GROQ_API,
    openrouter: process.env.OPENROUTER_API,
    mistral: process.env.MISTRAL_API
};

// Route to serve the main HTML page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Proxy route for model-specific requests
app.post("/api/chat", async (req, res) => {
    // Forward /api/chat to /api/models/reply to keep things backward compatible
    res.redirect(307, "/api/models/reply");
});

// Model display names lookup
const fallbackModelsMeta = {
    "gemini-1.5-flash": "Gemini 1.5 Flash",
    "models/gemini-1.5-flash": "Gemini 1.5 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "models/gemini-1.5-pro": "Gemini 1.5 Pro",
    "llama3-8b-8192": "Llama 3 8B (Groq)",
    "llama3-70b-8192": "Llama 3 70B (Groq)",
    "mixtral-8x7b-32768": "Mixtral 8x7B (Groq)",
    "open-mistral-7b": "Mistral 7B",
    "mistral-tiny": "Mistral Tiny",
    "google/gemini-2.5-flash": "Google Gemini 2.5 Flash",
    "meta-llama/llama-3-8b-instruct:free": "Llama 3 8B Instruct (Free)"
};

// Get a human-readable display name for a model
function getModelDisplayName(provider, modelId) {
    if (fallbackModelsMeta[modelId]) {
        return fallbackModelsMeta[modelId];
    }
    let name = modelId;
    if (name.includes("/")) {
        name = name.split("/").pop();
    }
    return name
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase()) + ` (${provider.toUpperCase()})`;
}

// Fallback models definition
const fallbackQueue = [
    { provider: "gemini", model: "models/gemini-1.5-flash" },
    { provider: "gemini", model: "models/gemini-1.5-pro" },
    { provider: "groq", model: "llama3-8b-8192" },
    { provider: "groq", model: "llama3-70b-8192" },
    { provider: "groq", model: "mixtral-8x7b-32768" },
    { provider: "mistral", model: "open-mistral-7b" },
    { provider: "mistral", model: "mistral-tiny" },
    { provider: "openrouter", model: "meta-llama/llama-3-8b-instruct:free" },
    { provider: "openrouter", model: "google/gemini-2.5-flash" }
];

// Helper to invoke a specific model API
async function callModel(provider, model, text) {
    if (provider === "gemini") {
        const rawModel = model || "gemini-1.5-flash";
        const cleanModel = rawModel.startsWith("models/") ? rawModel.substring(7) : rawModel;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${APIs.gemini}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: text }] }] })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Gemini API returned status ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error("No response text found in Gemini response.");
        return responseText;

    } else if (provider === "groq") {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${APIs.groq}`
            },
            body: JSON.stringify({
                messages: [{ role: "user", content: text }],
                model: model
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Groq API returned status ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content;
        if (!responseText) throw new Error("No response text found in Groq response.");
        return responseText;

    } else if (provider === "openrouter") {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${APIs.openrouter}`
            },
            body: JSON.stringify({
                messages: [{ role: "user", content: text }],
                model: model
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `OpenRouter API returned status ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content;
        if (!responseText) throw new Error("No response text found in OpenRouter response.");
        return responseText;

    } else if (provider === "mistral") {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${APIs.mistral}`
            },
            body: JSON.stringify({
                messages: [{ role: "user", content: text }],
                model: model
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Mistral API returned status ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content;
        if (!responseText) throw new Error("No response text found in Mistral response.");
        return responseText;
    } else {
        throw new Error(`Unsupported provider: ${provider}`);
    }
}

// Proxy route to fetch models for a given provider
app.get("/api/models/:provider", async (req, res) => {
    const { provider } = req.params;

    try {
        if (provider === "gemini") {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${APIs.gemini}`);
            if (!response.ok) throw new Error(`Gemini models fetch returned status ${response.status}`);
            const data = await response.json();
            res.json(data);

        } else if (provider === "groq") {
            const response = await fetch("https://api.groq.com/openai/v1/models", {
                headers: { "Authorization": `Bearer ${APIs.groq}` }
            });
            if (!response.ok) throw new Error(`Groq models fetch returned status ${response.status}`);
            const data = await response.json();
            res.json(data);

        } else if (provider === "openrouter") {
            const response = await fetch("https://openrouter.ai/api/v1/models", {
                headers: { "Authorization": `Bearer ${APIs.openrouter}` }
            });
            if (!response.ok) throw new Error(`OpenRouter models fetch returned status ${response.status}`);
            const data = await response.json();
            res.json(data);

        } else if (provider === "mistral") {
            const response = await fetch("https://api.mistral.ai/v1/models", {
                headers: { "Authorization": `Bearer ${APIs.mistral}` }
            });
            if (!response.ok) throw new Error(`Mistral models fetch returned status ${response.status}`);
            const data = await response.json();
            res.json(data);

        } else {
            res.status(400).json({ error: "Unsupported provider." });
        }
    } catch (error) {
        console.error(`Error fetching models for ${provider}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/models/reply", async (req, res) => {
    const { provider, model, text } = req.body;

    if (!provider || !text) {
        return res.status(400).json({ error: "Provider and text are required." });
    }

    // 1. Build the candidate list of models to try
    const candidates = [];

    // First candidate: user-selected provider and model
    candidates.push({ provider, model });

    // Helper to check if two candidate objects represent the same model configuration
    const isSameModel = (a, b) => {
        const normalize = (prov, md) => {
            if (prov === "gemini" && md) {
                return md.startsWith("models/") ? md : `models/${md}`;
            }
            return md;
        };
        return a.provider === b.provider && normalize(a.provider, a.model) === normalize(b.provider, b.model);
    };

    // Second candidate category: other models from the same requested provider
    fallbackQueue.forEach(item => {
        if (item.provider === provider && !isSameModel(item, { provider, model })) {
            candidates.push(item);
        }
    });

    // Third candidate category: models from other providers
    fallbackQueue.forEach(item => {
        if (item.provider !== provider && !isSameModel(item, { provider, model })) {
            candidates.push(item);
        }
    });

    // 2. Try the candidates in order
    const attempts = [];
    let responseText = null;
    let successfulCandidate = null;

    for (const candidate of candidates) {
        try {
            console.log(`Attempting completion with provider: ${candidate.provider}, model: ${candidate.model}...`);
            const response = await callModel(candidate.provider, candidate.model, text);
            responseText = response;
            successfulCandidate = candidate;
            break; // Succeeded!
        } catch (error) {
            console.error(`Failed attempt with ${candidate.provider} / ${candidate.model}: ${error.message}`);
            attempts.push({
                provider: candidate.provider,
                model: candidate.model,
                error: error.message
            });
        }
    }

    if (successfulCandidate) {
        const isFallback = !isSameModel(successfulCandidate, { provider, model });
        res.json({
            response: responseText,
            provider: successfulCandidate.provider,
            model: successfulCandidate.model,
            modelName: getModelDisplayName(successfulCandidate.provider, successfulCandidate.model),
            fallbackUsed: isFallback,
            attempts: attempts
        });
    } else {
        // All models failed
        res.status(500).json({
            error: "All attempted models failed to generate a response.",
            attempts: attempts
        });
    }
});


if (require.main === module) {
    app.listen(3000, () => {
        console.log("Server is running on http://localhost:3000");
    });
}

module.exports = app;