import Groq from 'groq-sdk';

// Errors where a different key can succeed: rate or token limit hit (429), or the key
// itself rejected (401/403). Model and request errors would fail the same way on any key.
const FALLBACK_STATUSES = new Set([429, 401, 403]);

const clients = new Map<string, Groq>();
const clientFor = (apiKey: string) => {
  let client = clients.get(apiKey);
  // One SDK retry at most: a limited key should hand over to the backup quickly.
  if (!client) clients.set(apiKey, (client = new Groq({ apiKey, maxRetries: 1 })));
  return client;
};

/**
 * Runs a Groq call on the feature's own key (e.g. GROQ_VISION_API_KEY), then once more on
 * the shared backup GROQ_API_KEY if the first key is limited, rejected or not set.
 */
export async function withGroq<T>(keyEnv: string, run: (client: Groq) => Promise<T>): Promise<T> {
  const keys = [
    { name: keyEnv, value: process.env[keyEnv]?.trim() },
    { name: 'GROQ_API_KEY', value: process.env.GROQ_API_KEY?.trim() },
  ].filter((k, i, all): k is { name: string; value: string } =>
    !!k.value && all.findIndex((o) => o.value === k.value) === i);

  if (!keys.length) throw new Error(`${keyEnv} is not set (and no GROQ_API_KEY backup)`);

  for (let i = 0; ; i++) {
    try {
      return await run(clientFor(keys[i].value));
    } catch (err: any) {
      const next = keys[i + 1];
      if (!next || !FALLBACK_STATUSES.has(err?.status)) throw err;
      console.warn(`[GROQ] ${keys[i].name} failed with ${err.status}; retrying on ${next.name}`);
    }
  }
}

export const hasGroqKey = (keyEnv: string) => !!(process.env[keyEnv]?.trim() || process.env.GROQ_API_KEY?.trim());
