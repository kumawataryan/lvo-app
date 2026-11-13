// Server-only helper for OpenRouter's OpenAI-compatible chat endpoint.
// Never import this from a client component: it reads the API keys from the server environment.

export const DEFAULT_OPENROUTER_MODEL = "dots-studio/dots-3-note-preview:free";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Every key name we accept. Numbered keys are used when set; the unnumbered ones still work on their own.
const KEY_ENV_NAMES = [
  "OPEN_ROUTER_API_KEY_1",
  "OPEN_ROUTER_API_KEY_2",
  "OPEN_ROUTER_API_KEY_3",
  "OPEN_ROUTER_API_KEY_4",
  "OPEN_ROUTER_API_KEY_5",
  "OPEN_ROUTER_API_KEY",
  "OPENROUTER_API_KEY",
];

// Errors that mean "this key cannot serve the request right now", so the next key is worth trying.
const ROTATE_STATUSES = new Set([401, 402, 403, 429]);

// Round-robin start position, so load spreads across keys instead of always hitting the first one.
let nextKeyIndex = 0;

export function openRouterKeys(): string[] {
  const keys = KEY_ENV_NAMES
    .map((name) => process.env[name]?.trim() ?? "")
    .filter(Boolean);
  return [...new Set(keys)];
}

export function openRouterConfig() {
  return {
    keys: openRouterKeys(),
    model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
  };
}

// Returns the keys in the order to try them: starting from the next round-robin position.
function keyOrder(keys: string[]) {
  const start = nextKeyIndex % keys.length;
  nextKeyIndex = (nextKeyIndex + 1) % Math.max(keys.length, 1);
  return [...keys.slice(start), ...keys.slice(0, start)];
}

async function callOnce(
  apiKey: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | Array<Record<string, unknown>> }>,
  { model, temperature, maxTokens }: { model: string; temperature: number; maxTokens: number },
) {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Template Studio",
    },
    // Turn off hidden reasoning: it otherwise uses the token budget and leaves the JSON answer empty.
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, reasoning: { enabled: false } }),
    signal: AbortSignal.timeout(90_000),
    cache: "no-store",
  });
}

export async function requestOpenRouterText(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | Array<Record<string, unknown>> }>,
  { keys, model, temperature = 0.6, maxTokens = 2000 }: { keys: string[]; model: string; temperature?: number; maxTokens?: number },
): Promise<string> {
  if (!keys.length) throw new Error("No OpenRouter API key is configured.");

  let lastStatus = 0;
  for (const apiKey of keyOrder(keys)) {
    const response = await callOnce(apiKey, messages, { model, temperature, maxTokens });
    if (!response.ok) {
      lastStatus = response.status;
      // Try the next key only when this one is rate-limited, out of credit or refused; other errors are final.
      if (ROTATE_STATUSES.has(response.status)) continue;
      throw new Error(`OpenRouter request failed (${response.status}).`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("The AI returned an empty draft.");
    return content;
  }
  throw new Error(`Every OpenRouter key failed (last status ${lastStatus}).`);
}
