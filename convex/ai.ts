"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// LLM caller layer — provider switch via env
// ============================================================
// Env: LLM_PROVIDER = "openai" | "gemini"  (default: mock)
//      OPENAI_API_KEY  — for OpenAI
//      GEMINI_API_KEY  — for Google Gemini
//      OPENAI_MODEL    — optional, defaults to gpt-4o-mini
//      GEMINI_MODEL    — optional, defaults to gemini-1.5-flash
//
// Both providers expose the same `callLLM` surface so the rest
// of the app is provider-agnostic.
// ============================================================

type Provider = "openai" | "gemini" | "mock";

function getProvider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? "").toLowerCase().trim();
  if (p === "openai" || p === "gemini") return p as Provider;
  // Auto-detect if keys present but provider not set
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}
function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
}

// ---- low-level callers ----

async function callOpenAI(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = getOpenAIModel();
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 600)}`);
  }
  const j: any = await res.json();
  const out = j?.choices?.[0]?.message?.content;
  if (!out) throw new Error("OpenAI empty response");
  return String(out).trim();
}

async function callGemini(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const fullPrompt = system ? `${system}\n\nUser: ${prompt}` : prompt;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 600)}`);
  }
  const j: any = await res.json();
  const parts = j?.candidates?.[0]?.content?.parts;
  const out = parts?.map((p: any) => p.text).join("\n") ?? "";
  if (!out) throw new Error("Gemini empty response");
  return String(out).trim();
}

// Mock fallback — deterministic but useful so the game works without keys
function mockCounterQuestion(topic: string, turnCount: number, lastExplanation: string): string {
  const mocks = [
    `Nice! You mentioned "${lastExplanation.slice(0, 60)}...". But could you explain **${topic}** without using jargon — like to a 10-year-old? What analogy would you use?`,
    `Interesting — follow-up #${turnCount + 1}: If someone says "${topic} is just magic," how would you prove them wrong with a simple everyday example?`,
    `Good progress! Now go one level deeper: what is the single step in **${topic}** people most misunderstand, and why?`,
    `Challenge: explain the *why* not just the *what*. Why does **${topic}** matter in real life? Give one concrete consequence if it disappeared.`,
    `Final probe: If you had to teach **${topic}** in 30 seconds with only 3 sentences, what would they be?`,
  ];
  return mocks[Math.min(turnCount, mocks.length - 1)]!;
}

function mockRating(topic: string, explanations: string[]): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
  xpAwarded: number;
} {
  const avgLen = explanations.reduce((a, b) => a + b.length, 0) / Math.max(1, explanations.length);
  const base = Math.min(95, Math.max(35, Math.round(55 + avgLen / 18 + explanations.length * 6 + Math.random() * 8)));
  return {
    score: base,
    strengths: [
      explanations.length >= 3 ? "Stayed consistent across multiple turns" : "Clear initial framing",
      avgLen > 80 ? "Good depth and detail" : "Concise explanations",
      "Used simple language well",
    ].slice(0, 2),
    weaknesses: [
      base < 70 ? "Add a concrete analogy (e.g., everyday object) to make it stick" : "Could tighten one loop with a stronger example",
      explanations.some((e) => e.length < 40) ? "One answer was too short — expand with why/how" : "Try anticipating the 'but why?' follow-up",
    ].slice(0, 2),
    feedback:
      base >= 80
        ? `Excellent grasp of ${topic}! You explained with clarity and handled the Socratic counters well. Keep using that Feynman loop for even deeper recall.`
        : base >= 60
          ? `Solid understanding of ${topic}. Your explanations were sound but add one vivid analogy and a real-world consequence to reach mastery.`
          : `Good start on ${topic}. You have the outline — now drill the core mechanism with a simple story a kid would remember.`,
    xpAwarded: 20 + Math.round(base / 2) + explanations.length * 8,
  };
}

// Public unified entry — used internally and exposed as action
export async function callLLM(prompt: string, system?: string): Promise<{ text: string; provider: Provider }> {
  const prov = getProvider();
  if (prov === "openai") {
    const text = await callOpenAI(prompt, system);
    return { text, provider: prov };
  }
  if (prov === "gemini") {
    const text = await callGemini(prompt, system);
    return { text, provider: prov };
  }
  // mock
  return { text: `[mock:${prov}] ${prompt.slice(0, 200)}`, provider: "mock" };
}

// ---- High-level Feynman helpers (used by feynman.ts) ----

export async function generateCounterQuestionLLM(args: {
  topic: string;
  history: { role: "user" | "ai"; content: string }[];
  turnCount: number;
  lastExplanation: string;
}): Promise<string> {
  const prov = getProvider();
  if (prov === "mock") return mockCounterQuestion(args.topic, args.turnCount, args.lastExplanation);

  const system =
    "You are a Socratic Feynman tutor. Your job is to poke holes in the learner's explanation with ONE short, sharp follow-up question. " +
    "Rules: (1) Be curious, supportive but probing. (2) Ask exactly ONE question, 1-2 sentences, max 40 words. (3) Stay tightly on topic. (4) Prefer 'what if' / 'why' / analogy-busting angles. (5) Never answer for them.";
  const historyBlock = args.history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "Learner" : "Tutor"}: ${h.content}`)
    .join("\n");
  const prompt =
    `Topic: ${args.topic}\n` +
    `Turn: ${args.turnCount + 1} / 5\n` +
    `Conversation so far:\n${historyBlock}\n\n` +
    `Latest learner explanation: """${args.lastExplanation}"""\n\n` +
    `Generate the next counter-question (ONE question only):`;
  try {
    const { text } = await callLLM(prompt, system);
    // Force to one question — trim to first ? chunk if model is verbose
    let q = text.trim().replace(/^["“]+|["”]+$/g, "");
    if (!q.includes("?")) q = q.split(".").slice(0, 1).join(".") + "?";
    // Cap length
    if (q.length > 220) q = q.slice(0, 217) + "...";
    return q;
  } catch (e) {
    console.warn("LLM counter question failed, falling back to mock", e);
    return mockCounterQuestion(args.topic, args.turnCount, args.lastExplanation);
  }
}

export type RatingResult = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
  xpAwarded: number;
};

export async function rateSessionLLM(args: {
  topic: string;
  explanations: string[];
  questions: string[];
}): Promise<RatingResult> {
  const prov = getProvider();
  if (prov === "mock") return mockRating(args.topic, args.explanations);

  const system =
    "You are a Feynman technique evaluator. Rate the learner's understanding from the full loop. " +
    "Return ONLY valid JSON with keys: score (0-100 int), strengths (2-3 short bullets), weaknesses (2-3 short bullets), feedback (2-4 sentences). " +
    "Be honest, constructive, encourage growth. No extra text outside JSON.";

  const convo = args.explanations
    .map((ex, i) => `Q${i + 1}: ${args.questions[i] ?? "(initial explain " + args.topic + ")"}\nA${i + 1}: ${ex}`)
    .join("\n\n");

  const prompt =
    `Topic: ${args.topic}\n` +
    `Full Feynman loop:\n${convo}\n\n` +
    `Score criteria: clarity, correctness, simplicity (could a 12yo get it), depth, handling of counter-questions.\n` +
    `Respond as JSON only.`;

  try {
    const { text } = await callLLM(prompt, system);
    // Extract JSON block
    const jsonStr = text.includes("```") ? (text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ?? text) : text;
    const cleaned = jsonStr.slice(jsonStr.indexOf("{"), jsonStr.lastIndexOf("}") + 1);
    const j = JSON.parse(cleaned);
    const score = Math.max(0, Math.min(100, Math.round(Number(j.score) || 60)));
    const strengths: string[] = (Array.isArray(j.strengths) ? j.strengths : []).slice(0, 3).map(String);
    const weaknesses: string[] = (Array.isArray(j.weaknesses) ? j.weaknesses : []).slice(0, 3).map(String);
    const feedback: string = String(j.feedback ?? "").slice(0, 600) || mockRating(args.topic, args.explanations).feedback;
    const xpAwarded = 20 + Math.round(score / 1.8) + args.explanations.length * 6;
    return {
      score,
      strengths: strengths.length ? strengths : mockRating(args.topic, args.explanations).strengths,
      weaknesses: weaknesses.length ? weaknesses : mockRating(args.topic, args.explanations).weaknesses,
      feedback,
      xpAwarded,
    };
  } catch (e) {
    console.warn("LLM rating failed, fallback to mock", e);
    return mockRating(args.topic, args.explanations);
  }
}

// ---- Exposed Convex actions ----

export const generateQuestion = action({
  args: {
    topic: v.string(),
    lastExplanation: v.string(),
    turnCount: v.number(),
    history: v.optional(v.array(v.object({ role: v.union(v.literal("user"), v.literal("ai")), content: v.string() }))),
  },
  handler: async (_ctx, args) => {
    const q = await generateCounterQuestionLLM({
      topic: args.topic,
      lastExplanation: args.lastExplanation,
      turnCount: args.turnCount,
      history: args.history ?? [],
    });
    return { question: q, provider: getProvider() };
  },
});

export const rate = action({
  args: {
    topic: v.string(),
    explanations: v.array(v.string()),
    questions: v.array(v.string()),
  },
  handler: async (_ctx, args) => {
    const r = await rateSessionLLM(args);
    return { ...r, provider: getProvider() };
  },
});

export const health = action({
  args: {},
  handler: async () => {
    const prov = getProvider();
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    return {
      provider: prov,
      hasOpenAI,
      hasGemini,
      openaiModel: getOpenAIModel(),
      geminiModel: getGeminiModel(),
      mock: prov === "mock",
    };
  },
});
