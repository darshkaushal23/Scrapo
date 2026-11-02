import { localExplanation, requestedCategory, type RankedDevice } from "./rank";

type CacheEntry = { at: number; text: Record<string, string> };

const cache = new Map<string, CacheEntry>();
const CACHE_MS = 10 * 60 * 1000;

export async function explainMatches(need: string, devices: RankedDevice[]) {
  const category = requestedCategory(need);
  const fallback = Object.fromEntries(
    devices.map((device) => [device.id, category ? localExplanation(device, category) : localExplanation(device, device.category)]),
  );
  if (devices.length === 0) return { explanations: fallback, source: "skipped" as const };

  const key = cacheKey(need, devices);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return { explanations: { ...fallback, ...hit.text }, source: "cached" as const };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { explanations: fallback, source: "unavailable" as const };

  try {
    const text = await askGemini(apiKey, need, devices);
    const parsed = parseExplanations(text, devices);
    cache.set(key, { at: Date.now(), text: parsed });
    return { explanations: { ...fallback, ...parsed }, source: "live" as const };
  } catch {
    return { explanations: fallback, source: "unavailable" as const };
  }
}

async function askGemini(apiKey: string, need: string, devices: RankedDevice[]) {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const prompt = [
    "Write one short factual sentence for each device.",
    "Use only the fields given. Do not invent specifications, prices, or availability.",
    "The fit field is already decided. Do not change it.",
    "Return JSON with an items array of id and explanation.",
    `Student request: ${need}`,
    `Devices: ${JSON.stringify(devices.map((device) => ({
      id: device.id,
      title: device.title,
      category: device.category,
      condition: device.condition,
      campus: device.campus,
      fit: device.fit,
    })))}`,
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              items: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    explanation: { type: "STRING" },
                  },
                  required: ["id", "explanation"],
                },
              },
            },
            required: ["items"],
          },
        },
      }),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) throw new Error("Gemini request failed");
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

function parseExplanations(text: string, devices: RankedDevice[]) {
  const allowed = new Set(devices.map((device) => device.id));
  const body = JSON.parse(text) as { items?: Array<{ id?: string; explanation?: string }> };
  const explanations: Record<string, string> = {};
  for (const item of body.items ?? []) {
    if (!item.id || !allowed.has(item.id) || !item.explanation) continue;
    explanations[item.id] = item.explanation.replace(/\s+/g, " ").trim().slice(0, 220);
  }
  return explanations;
}

function cacheKey(need: string, devices: RankedDevice[]) {
  const raw = `${need.trim().toLowerCase()}|${devices.map((device) => `${device.id}:${device.fit}:${device.condition}`).join(",")}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) hash = Math.imul(31, hash) + raw.charCodeAt(index);
  return String(hash);
}
