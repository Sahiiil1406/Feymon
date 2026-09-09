// Frontend LLM helper — mirrors convex/ai.ts provider switch.
// Main Feynman loop calls go through Convex actions (convex/ai.ts + convex/feynman.ts)
// so keys stay server-side. This file is useful for:
// - documenting the provider env
// - client-side provider health check
// - optional direct browser-side calls (if you expose a proxied endpoint)

export type LlmProvider = "openai" | "gemini" | "mock";

export function getFrontendProvider(): LlmProvider {
  const raw = (import.meta as any).env?.VITE_LLM_PROVIDER ?? (import.meta as any).env?.LLM_PROVIDER ?? "";
  const p = String(raw).toLowerCase().trim();
  if (p === "openai" || p === "gemini") return p;
  return "mock";
}

// For UI badge
export function providerLabel(p: LlmProvider): string {
  if (p === "openai") return "OpenAI";
  if (p === "gemini") return "Gemini";
  return "Mock (no key)";
}

export const FEYNMAN_SYSTEM_PROMPT = `You are a Socratic Feynman tutor. Ask ONE probing follow-up question at a time.`;
