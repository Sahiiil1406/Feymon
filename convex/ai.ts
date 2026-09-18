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

// ============================================================
// NPC dynamic dialogue — 2-3 fallbacks per NPC + LLM variation
// Every interaction yields a fresh line; on LLM failure a random
// fallback is returned so the game never blocks.
// ============================================================

export const OVERWORLD_NPC_FALLBACKS: Record<string, string[]> = {
  "Prof. Oak": [
    "Ah! A new trainer! Want to try the Feynman trial? Explain PHOTOSYNTHESIS to me like I'm 10!",
    "Welcome back! Ready to photosynthesize your knowledge? Teach me how plants cook with sunlight!",
    "Plants are green chefs — can you explain their recipe without jargon?",
  ],
  "Curious Maya": [
    "I know loops... but recursion sounds like magic? Can you teach me?",
    "If a function calls itself, how does it ever stop? Explain the base case like I'm 11!",
    "My brother said recursion is mirrors in mirrors — is that right?",
  ],
  "Rival Kai": [
    "Heh, bet you can't explain Supply & Demand with Pokemon cards. Try me!",
    "Economics is just battles — rare cards vs many trainers. Break it down, if you can!",
    "I mastered the market. Prove you understand price vs demand!",
  ],
  "Stargazer Nova": [
    "The stars hide a secret... why does even light get trapped? Tell me, traveler.",
    "Imagine a trampoline so deep even marbles of light can't roll out — explain that!",
    "What would you see at the edge of an abyss? Teach me black holes simply.",
  ],
  "Coder Lin": [
    "Yo! Neural nets are just stacked guessers. Prove you can explain it simply?",
    "Layers of tiny decision-makers — how would you teach that to a newbie?",
    "Input → hidden → output — make that click without buzzwords!",
  ],
  "Nurse Joy": [
    "Welcome to Feymon Center! Heal up, then explore town to find the others!",
    "Need a breather? The Dojo's center awaits — that's where you level up!",
    "Everyone starts as Lv1 — find the masters in the village to learn!",
  ],
};

export const DOJO_NPC_FALLBACKS: Record<string, string[]> = {
  "dojo-sensei": [
    "Welcome, seeker. You have entered the heart of the dojo. Speak your topic simply — I will counter, you will clarify. Ready to evolve?",
    "Clarity is form. Teach me as you would a child, and your avatar shall reflect your understanding.",
    "Each explanation is a strike. Each counter, a parry. Step forward?",
  ],
  "dojo-assist": [
    "I help find the gaps in simple explanations. The master will test your analogies — I note where you hide jargon.",
    "Jargon hides not knowing. I'll listen for the word you skip.",
    "Simplify till a kid nods — that's my cue.",
  ],
  "dojo-scholar": [
    "Every idea has a hidden assumption. I will ask the question you didn't expect...",
    "What if your analogy is wrong? That's where learning lives.",
    "I'll be your friendly contradiction — ready?",
  ],
  "dojo-rival": [
    "Heh, think you can teach it cold? The sensei gives you a score 1–10. Try to beat my 8.4 on Recursion!",
    "I got 8.4 by nailing my analogy. What's yours?",
    "Don't memorize — embody. Let's see your score!",
  ],
};

function pickFallback(
  key: string,
  isDojo: boolean,
  playerName?: string,
  playerLevel?: number,
): string {
  const map = isDojo ? DOJO_NPC_FALLBACKS : OVERWORLD_NPC_FALLBACKS;
  const arr = map[key] ?? (isDojo ? DOJO_NPC_FALLBACKS["dojo-sensei"]! : OVERWORLD_NPC_FALLBACKS["Prof. Oak"]!);
  let base = arr[Math.floor(Math.random() * arr.length)]!;
  // Light personalization 35% of the time so fallbacks still feel fresh
  if (playerName && Math.random() > 0.65) {
    const safeName = playerName.slice(0, 16);
    if (base.includes("traveler") || base.includes("trainer") || base.includes("seeker")) {
      base = base.replace(/traveler|trainer|seeker/g, safeName);
    } else if (!base.includes(safeName) && base.length < 120) {
      base = `${safeName}, ` + base.charAt(0).toLowerCase() + base.slice(1);
    }
  }
  if (playerLevel && playerLevel > 1 && Math.random() > 0.7 && !base.includes("Lv")) {
    base = base.replace(/Ready to/, `Lv${playerLevel} — ready to`);
  }
  return base;
}

export async function generateNpcDialogueLLM(args: {
  npcName: string;
  role: string;
  personality: string;
  topicTitle?: string;
  topicPrompt?: string;
  playerName?: string;
  playerLevel?: number;
  isDojo?: boolean;
  dojoNpcId?: string;
}): Promise<string> {
  const fallbackKey = args.isDojo && args.dojoNpcId ? args.dojoNpcId : args.npcName;
  const fallback = () => pickFallback(fallbackKey, !!args.isDojo, args.playerName, args.playerLevel);

  const prov = getProvider();
  if (prov === "mock") {
    // Mock still varies: rotate fallback + occasionally inject player level
    return fallback();
  }

  // Build system + prompt tailored to personality
  const nonce = Math.random().toString(36).slice(2, 7);
  const topicBlock = args.topicTitle
    ? `Topic specialty: "${args.topicTitle}" — ${args.topicPrompt ?? ""}`.trim()
    : `You are a dojo guide, not tied to a single topic. Encourage Feynman teaching in general.`;

  const systemBase =
    `You are ${args.npcName}, a ${args.role}. Personality: ${args.personality}. ` +
    `You live in Feymon Village, a warm Pokemon-inspired learning plaza. ` +
    `Speak in character, 1-2 sentences, max 42 words. Be warm, curious, and invite the player to explain simply (Feynman technique: analogy for a 10-year-old, no jargon). ` +
    `Never be rude. Vary phrasing — avoid repeating past lines verbatim. Provide ONLY the dialogue line, no quotes, no stage directions.`;

  const playerBlock = args.playerName
    ? `Player: ${args.playerName} (Lv${args.playerLevel ?? 1}). Variation seed: ${nonce}. Make it feel personal and fresh.`
    : `Variation seed: ${nonce}. Make this greeting feel fresh and unrepeated.`;

  const prompt =
    `${topicBlock}\n` +
    `${playerBlock}\n` +
    `Generate the greeting now — one fresh intro line that tees up the Feynman challenge:`;

  try {
    const { text } = await callLLM(prompt, systemBase);
    let out = text.trim().replace(/^["“']+|["”']+$/g, "").trim();
    // Strip any echoed role prefix like "Prof. Oak:" 
    out = out.replace(/^[^:]{1,30}:\s*/, "");
    // Keep to 1-2 sentences / ~180 chars
    if (out.length > 220) {
      const sentences = out.split(/(?<=[.!?])\s+/);
      out = sentences.slice(0, 2).join(" ");
      if (out.length > 220) out = out.slice(0, 217) + "...";
    }
    if (!out) return fallback();
    // Ensure it ends with punctuation
    if (!/[.!?]$/.test(out)) out += "!";
    return out;
  } catch (e) {
    console.warn("LLM NPC dialogue failed, falling back", fallbackKey, e);
    return fallback();
  }
}

export async function generateDojoDialogueLLM(args: {
  dojoNpcId: string;
  playerName?: string;
  playerLevel?: number;
}): Promise<string> {
  const defs: Record<string, { name: string; role: string; personality: string }> = {
    "dojo-sensei": {
      name: "Master Kairo",
      role: "AI Sensei • Dojo Master",
      personality: "Wise, warm, disciplined, speaks in short poetic lines, loves clarity over cleverness",
    },
    "dojo-assist": {
      name: "Acolyte Rin",
      role: "Gap Finder",
      personality: "Observant, gentle, points out jargon and hidden complexity",
    },
    "dojo-scholar": {
      name: "Scholar Nova",
      role: "Socratic Scholar",
      personality: "Inquisitive, loves hidden assumptions and 'what if' twists",
    },
    "dojo-rival": {
      name: "Rival Kai",
      role: "Rival • Score Chaser",
      personality: "Competitive, playful, brags about 8.4 but respects good teaching",
    },
  };
  const d = defs[args.dojoNpcId] ?? defs["dojo-sensei"]!;
  return generateNpcDialogueLLM({
    npcName: d.name,
    role: d.role,
    personality: d.personality,
    isDojo: true,
    dojoNpcId: args.dojoNpcId,
    playerName: args.playerName,
    playerLevel: args.playerLevel,
  });
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

// ---- NPC dynamic dialogue actions (every talk is LLM-fresh, 2-3 fallbacks each) ----

export const generateNpcDialogue = action({
  args: {
    npcName: v.string(),
    role: v.optional(v.string()),
    personality: v.optional(v.string()),
    topicTitle: v.optional(v.string()),
    topicPrompt: v.optional(v.string()),
    playerName: v.optional(v.string()),
    playerLevel: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const dialogue = await generateNpcDialogueLLM({
      npcName: args.npcName,
      role: args.role ?? "Village NPC",
      personality: args.personality ?? "Warm and curious",
      topicTitle: args.topicTitle,
      topicPrompt: args.topicPrompt,
      playerName: args.playerName,
      playerLevel: args.playerLevel,
      isDojo: false,
    });
    return { dialogue, provider: getProvider() };
  },
});

export const generateDojoDialogue = action({
  args: {
    dojoNpcId: v.string(),
    playerName: v.optional(v.string()),
    playerLevel: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const dialogue = await generateDojoDialogueLLM({
      dojoNpcId: args.dojoNpcId,
      playerName: args.playerName,
      playerLevel: args.playerLevel,
    });
    return { dialogue, provider: getProvider() };
  },
});
