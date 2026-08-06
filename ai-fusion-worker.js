/**
 * Asset Galaxy AI Fusion Worker
 *
 * Required secret:
 *   OPENROUTER_API_KEY
 *
 * Recommended secrets/variables:
 *   APP_ACCESS_TOKEN  - optional long random access code
 *   ALLOWED_ORIGIN    - exact GitHub Pages origin, e.g. https://username.github.io
 *   AI_MODEL_MAP      - optional JSON mapping provider names to exact OpenRouter model IDs
 *   FUSION_MODEL      - optional exact model ID used to combine council answers
 */

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const MAX_BODY_BYTES = 80_000;
const MAX_PROVIDER_CALLS = 6;
const MODEL_CACHE_MS = 20 * 60 * 1000;

const PROVIDERS = {
  openai: {label:"OpenAI", prefixes:["openai/"]},
  claude: {label:"Claude", prefixes:["anthropic/"]},
  gemini: {label:"Gemini", prefixes:["google/"]},
  grok: {label:"Grok", prefixes:["x-ai/"]},
  deepseek: {label:"DeepSeek", prefixes:["deepseek/"]},
  llama: {label:"Llama", prefixes:["meta-llama/"]},
  mistral: {label:"Mistral", prefixes:["mistralai/"]},
  qwen: {label:"Qwen", prefixes:["qwen/"]}
};

let cachedModels = {time:0, data:[]};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {status:204, headers:cors});
    }

    if (!originAllowed(origin, env)) {
      return json({error:"This website origin is not allowed."}, 403, cors);
    }

    if (env.APP_ACCESS_TOKEN) {
      const supplied = request.headers.get("X-App-Token") || "";
      if (!constantTimeEqual(supplied, env.APP_ACCESS_TOKEN)) {
        return json({error:"The Worker access code is missing or incorrect."}, 401, cors);
      }
    }

    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok:true,
        gateway:"OpenRouter multi-model gateway",
        keyConfigured:Boolean(env.OPENROUTER_API_KEY),
        maxProviders:MAX_PROVIDER_CALLS
      }, env.OPENROUTER_API_KEY ? 200 : 503, cors);
    }

    if (url.pathname !== "/fusion" || request.method !== "POST") {
      return json({error:"Not found. Use GET /health or POST /fusion."}, 404, cors);
    }

    if (!env.OPENROUTER_API_KEY) {
      return json({error:"OPENROUTER_API_KEY is not configured as a Worker secret."}, 503, cors);
    }

    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > MAX_BODY_BYTES) return json({error:"Request is too large."}, 413, cors);

    try {
      const body = await request.json();
      const message = cleanText(body.message, 12_000);
      if (!message) return json({error:"A message is required."}, 400, cors);

      const mode = ["fast","council","full"].includes(body.mode) ? body.mode : "council";
      const role = ["playcanvas","debugger","assets","designer","general"].includes(body.role) ? body.role : "playcanvas";
      const limit = mode === "fast" ? 1 : mode === "full" ? MAX_PROVIDER_CALLS : 3;
      const requestedProviders = [...new Set(Array.isArray(body.providers) ? body.providers : [])]
        .filter(name => PROVIDERS[name])
        .slice(0, limit);
      if (!requestedProviders.length) requestedProviders.push("openai");

      const history = Array.isArray(body.history) ? body.history.slice(-8).map(item => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: cleanText(item?.content, 5000)
      })).filter(item => item.content) : [];
      const projectContext = cleanText(body.projectContext, 12_000);

      const availableModels = await getModels(env.OPENROUTER_API_KEY);
      const overrideMap = parseModelMap(env.AI_MODEL_MAP);
      const selections = requestedProviders.map(provider => ({
        provider,
        label: PROVIDERS[provider].label,
        model: overrideMap[provider] || pickModel(availableModels, provider)
      })).filter(item => item.model);

      if (!selections.length) {
        return json({error:"No compatible text models could be selected. Set AI_MODEL_MAP with exact OpenRouter model IDs."}, 503, cors);
      }

      const system = rolePrompt(role);
      const contextMessage = projectContext ? `PROJECT CONTEXT\n${projectContext}` : "No project context was supplied.";
      const councilPrompt = `${contextMessage}\n\nUSER REQUEST\n${message}\n\nGive an accurate, practical answer. When code is requested, use PlayCanvas JavaScript unless the user clearly asks for another stack. Keep phone-only editing in mind.`;

      const settled = await Promise.allSettled(selections.map(selection => callModel({
        apiKey: env.OPENROUTER_API_KEY,
        model: selection.model,
        messages: [
          {role:"system", content:system},
          ...history,
          {role:"user", content:councilPrompt}
        ],
        maxTokens: 900,
        temperature: 0.35,
        siteUrl: origin || env.ALLOWED_ORIGIN || "https://example.com"
      }).then(answer => ({...selection, answer}))));

      const answers = settled.filter(item => item.status === "fulfilled" && item.value.answer).map(item => item.value);
      if (!answers.length) {
        const failures = settled.filter(item => item.status === "rejected").map(item => String(item.reason?.message || item.reason)).slice(0,3);
        return json({error:`Every selected model request failed.${failures.length ? ` ${failures.join(" | ")}` : ""}`}, 502, cors);
      }

      let finalAnswer = answers[0].answer;
      if (answers.length > 1) {
        const fusionModel = env.FUSION_MODEL || answers[0].model;
        const councilText = answers.map((item,index) => `ANSWER ${index+1} — ${item.label} (${item.model})\n${item.answer}`).join("\n\n---\n\n");
        const synthesis = await callModel({
          apiKey: env.OPENROUTER_API_KEY,
          model: fusionModel,
          messages: [
            {role:"system", content:"You are the final editor of a multi-model AI council. Produce one self-contained answer. Resolve conflicts, remove repeated material, preserve correct code, state uncertainty honestly, and prioritize actionable phone-friendly PlayCanvas steps. Do not mention hidden deliberation."},
            {role:"user", content:`ORIGINAL REQUEST\n${message}\n\nPROJECT CONTEXT\n${projectContext || "None"}\n\nCOUNCIL ANSWERS\n${councilText.slice(0,30000)}`}
          ],
          maxTokens: 1400,
          temperature: 0.25,
          siteUrl: origin || env.ALLOWED_ORIGIN || "https://example.com"
        });
        if (synthesis) finalAnswer = synthesis;
      }

      return json({
        answer: finalAnswer,
        models: answers.map(item => `${item.label} · ${item.model}`),
        consulted: answers.length,
        mode
      }, 200, cors);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Unknown Worker error";
      return json({error:message}, 500, cors);
    }
  }
};

function rolePrompt(role) {
  const base = "You are one member of an AI council. Be precise, safe, and honest. Do not claim you changed a project unless the user supplies a tool that actually did so.";
  const prompts = {
    playcanvas: `${base} You specialize in PlayCanvas browser games, JavaScript scripts, entities, components, assets, mobile controls, performance, and step-by-step Editor instructions.`,
    debugger: `${base} You specialize in finding JavaScript, HTML, PlayCanvas, and game-logic bugs. Identify the likely cause before proposing a minimal fix.`,
    assets: `${base} You specialize in game asset planning, formats, licensing reminders, optimization, and PlayCanvas import workflows.`,
    designer: `${base} You specialize in game mechanics, UI, progression, accessibility, and mobile-friendly design.`,
    general: `${base} Answer the user's question directly and clearly.`
  };
  return prompts[role] || prompts.playcanvas;
}

async function callModel({apiKey, model, messages, maxTokens, temperature, siteUrl}) {
  const response = await fetch(OPENROUTER_CHAT_URL, {
    method:"POST",
    headers:{
      "Authorization":`Bearer ${apiKey}`,
      "Content-Type":"application/json",
      "HTTP-Referer":siteUrl,
      "X-Title":"Asset Galaxy AI Fusion"
    },
    body:JSON.stringify({model, messages, max_tokens:maxTokens, temperature})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `${model} failed with ${response.status}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map(part => typeof part === "string" ? part : part?.text || "").join("\n").trim();
  }
  return String(content || "").trim();
}

async function getModels(apiKey) {
  if (Date.now() - cachedModels.time < MODEL_CACHE_MS && cachedModels.data.length) return cachedModels.data;
  const response = await fetch(OPENROUTER_MODELS_URL, {headers:{"Authorization":`Bearer ${apiKey}`,"Accept":"application/json"}});
  if (!response.ok) throw new Error(`Could not load model catalog: ${response.status}`);
  const data = await response.json();
  cachedModels = {time:Date.now(), data:Array.isArray(data?.data) ? data.data : []};
  return cachedModels.data;
}

function pickModel(models, provider) {
  const prefixes = PROVIDERS[provider]?.prefixes || [];
  const excluded = /(image|audio|embedding|moderation|rerank|guard|tts|speech|whisper)/i;
  const candidates = models.filter(model => {
    const id = String(model?.id || "");
    return prefixes.some(prefix => id.startsWith(prefix)) && !excluded.test(id);
  });
  candidates.sort((a,b) => {
    const aFree = String(a.id).includes(":free") ? 1 : 0;
    const bFree = String(b.id).includes(":free") ? 1 : 0;
    if (aFree !== bFree) return aFree - bFree;
    const created = Number(b.created || 0) - Number(a.created || 0);
    if (created) return created;
    return Number(b.context_length || 0) - Number(a.context_length || 0);
  });
  return candidates[0]?.id || "";
}

function parseModelMap(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function cleanText(value, limit) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, limit);
}

function originAllowed(origin, env) {
  if (!env.ALLOWED_ORIGIN || !origin) return true;
  return origin === env.ALLOWED_ORIGIN;
}

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || origin || "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary":"Origin",
    "Access-Control-Allow-Headers":"Content-Type, X-App-Token",
    "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
    "Cache-Control":"no-store",
    "Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options":"nosniff"
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers:{...headers,"Content-Type":"application/json; charset=utf-8"}
  });
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
