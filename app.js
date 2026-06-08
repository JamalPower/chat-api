const express = require("express");
const path = require("path");
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const https = require('https');

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

// ========================
// Chat Reply Endpoint (supports both GET and POST)
// ========================
app.all("/api/models/reply", async (req, res) => {
    // Support both GET (query params) and POST (body)
    const { provider, model, text } = req.method === "GET" ? req.query : req.body;

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

// ========================
// Scraping endpoint 
// ========================

async function fetchHTMLSOURCE(url) {
    const agent = new https.Agent({
        ciphers: [
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
            'TLS_AES_128_GCM_SHA256',
            'ECDHE-ECDSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-ECDSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES256-GCM-SHA384'
        ].join(':'),
        honorCipherOrder: true,
        minVersion: 'TLSv1.2'
    });

    try {
        const response = await axios.get(url, {
            httpsAgent: agent, 
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Connection': 'keep-alive'
            },
            timeout: 10000
        });

        return response.data;

    } catch (error) {
        if (error.response) {
            console.error(`خطأ من السيرفر المستهدف: ${error.response.status}`);
            throw new Error(`Cloudflare blocked or server error: ${error.response.status}`);
        }
        console.error("خطأ أثناء جلب الكود المصدري للموقع:", error.message);
        throw error;
    }
}
app.get("/api/scrap/fetch", async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: "Missing required query parameter: url" });
    }

    try {
        const response = await fetchHTMLSOURCE(url);
        res.send(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

//==============autocomplete=====================//
async function getAutoComplete(query) {
    const targetUrl = `https://backloggd.com/autocomplete.json?filter_editions=true&query=${query}`
    const agent = new https.Agent({
        ciphers: [
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
            'TLS_AES_128_GCM_SHA256',
            'ECDHE-ECDSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-ECDSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES256-GCM-SHA384'
        ].join(':'),
        honorCipherOrder: true,
        minVersion: 'TLSv1.2'
    });

    try {
        const response = await axios.get(targetUrl, {
            httpsAgent: agent, 
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Connection': 'keep-alive'
            },
            timeout: 10000
        });

        return response.data;

    } catch (error) {
        if (error.response) {
            throw new Error(`Cloudflare blocked or server error: ${error.response.status}`);
        }
        throw error;
    }
}

app.get("/api/scrap/games/autocomplete", async (req, res) => {
    const {query} = req.query;
    var data = [];
    if (!query) {
        return res.status(400).json({ error: "Missing required query parameter: query" });
    }

    try {
        const response = await getAutoComplete(query);
        response.suggestions.forEach(suggestion => {
            data.push({
                name: suggestion.value,
                slug: suggestion.data.slug,
                year: suggestion.data.year
            });
        });
        const html = data.map(game =>
             `<div class="autocomplete-item" data-slug="${game.slug}">${game.name} (${game.year})</div>`
            ).join("");
        res.json({ status: "success", html });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

//===============================================//
//=================GET GAME PICTURE=================//
async function getGamesList(query) {
     const targetUrl = `https://backloggd.com/search/results.turbo_stream?page=1&query=${query.replace(" ", "+")}&type=games`
    const agent = new https.Agent({
        ciphers: [
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
            'TLS_AES_128_GCM_SHA256',
            'ECDHE-ECDSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-ECDSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES256-GCM-SHA384'
        ].join(':'),
        honorCipherOrder: true,
        minVersion: 'TLSv1.2'
    });

    try {
        const response = await axios.get(targetUrl, {
            httpsAgent: agent, 
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Connection': 'keep-alive'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response);
        const games = [];
        $('.col-12.result').each((index, element) => {
            const name = $(element).find('h3').text().trim();
            const img = $(element).find('img').attr('src');
            const year = $(element).find('h3 .subtitle-text').text().trim();
            const type = $(element).find('.game-result-type').text().trim();
            games.push({
             name:name,
             img:img,
             year:year, 
             type:type
            });
        });

        return games;

    } catch (error) {
        if (error.response) {
            throw new Error(`Cloudflare blocked or server error: ${error.response.status}`);
        }
        throw error;
    }
}
app.get("/api/scrap/games/list", async (req, res) => {
    const {query} = req.query;
    var data = [];
    if (!query) {
        return res.status(400).json({ error: "Missing required query parameter: query" });
    }

    try {
        const response = await getGamesList(query);
        res.json({ status: "success", games: response });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
});
//===================================================//
if (require.main === module) {
    app.listen(3000, () => {
        console.log("Server is running on http://localhost:3000");
    });
}

module.exports = app;