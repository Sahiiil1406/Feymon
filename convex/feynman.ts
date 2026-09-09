import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Helpers
function xpForLevel(level: number): number {
  // Simple curve: 100 * level
  return 100 * level;
}
function computeLevelUp(currentLevel: number, currentXp: number, gained: number) {
  let xp = currentXp + gained;
  let lvl = currentLevel;
  let leveled = false;
  while (xp >= xpForLevel(lvl)) {
    xp -= xpForLevel(lvl);
    lvl += 1;
    leveled = true;
  }
  // Cap? no
  return { level: lvl, xp, leveledUp: leveled };
}

// Create a new Feynman session — player picks topic
export const createSession = mutation({
  args: {
    playerId: v.id("players"),
    topic: v.string(),
    topicCategory: v.optional(v.string()),
    maxTurns: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.topic.trim().slice(0, 120);
    if (trimmed.length < 2) throw new Error("Topic too short");
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    // One active session at a time — abandon stale active
    const active = await ctx.db
      .query("feynmanSessions")
      .withIndex("by_playerId_and_status", (q) => q.eq("playerId", args.playerId).eq("status", "active"))
      .take(5);
    for (const s of active) {
      await ctx.db.patch(s._id, { status: "abandoned", completedAt: Date.now() });
    }

    const maxTurns = Math.min(Math.max(args.maxTurns ?? 4, 2), 8);

    const sessionId = await ctx.db.insert("feynmanSessions", {
      playerId: args.playerId,
      topic: trimmed,
      topicCategory: args.topicCategory?.slice(0, 40),
      status: "active",
      turnCount: 0,
      maxTurns,
      currentQuestion: `Explain "${trimmed}" in your own words — imagine you're teaching a curious 12-year-old. Keep it simple, use an analogy!`,
      levelBefore: player.level,
      createdAt: Date.now(),
    });

    // Seed initial AI question as a turn so history is complete
    const q = `Explain "${trimmed}" in your own words — imagine you're teaching a curious 12-year-old. Keep it simple, use an analogy!`;
    await ctx.db.insert("feynmanTurns", {
      sessionId,
      role: "ai_question",
      content: q,
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

// Submit explanation (text from speech-to-text or typed) — creates user turn, then AI generates next counter-question
export const submitExplanation = mutation({
  args: {
    sessionId: v.id("feynmanSessions"),
    playerId: v.id("players"),
    content: v.string(),
    isAudio: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.playerId !== args.playerId) throw new Error("Not your session");
    if (session.status !== "active") throw new Error("Session not active");
    const trimmed = args.content.trim().slice(0, 4000);
    if (trimmed.length < 10) throw new Error("Explanation too short — try at least a sentence or two");
    if (trimmed.length > 4000) throw new Error("Too long");

    // Save user turn
    await ctx.db.insert("feynmanTurns", {
      sessionId: args.sessionId,
      role: "user",
      content: trimmed,
      isAudio: args.isAudio ?? false,
      createdAt: Date.now(),
    });

    const nextTurnCount = session.turnCount + 1;

    // If reached maxTurns, mark ready for rating (keep active until explicit rate, but update turnCount)
    // Otherwise generate next counter-question via placeholder — actual LLM call happens in action submitAndGenerate
    // For direct mutation path (fallback mock), we set a placeholder question
    if (nextTurnCount >= session.maxTurns) {
      await ctx.db.patch(args.sessionId, {
        turnCount: nextTurnCount,
        currentQuestion: undefined, // signals "ready to rate"
      });
    } else {
      // Placeholder — will be replaced by action's LLM result
      await ctx.db.patch(args.sessionId, {
        turnCount: nextTurnCount,
        currentQuestion: "__generating__",
      });
    }

    return { turnCount: nextTurnCount, needsRating: nextTurnCount >= session.maxTurns };
  },
});

// Action that does submit + LLM generate in one flow (recommended from client)
export const submitAndGenerate = action({
  args: {
    sessionId: v.id("feynmanSessions"),
    playerId: v.id("players"),
    content: v.string(),
    isAudio: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ turnCount: number; needsRating: boolean; nextQuestion: string | null }> => {
    // 1) Run the mutation to save user turn
    const res: { turnCount: number; needsRating: boolean } = await ctx.runMutation(internal.feynman.submitExplanationInternal, {
      sessionId: args.sessionId,
      playerId: args.playerId,
      content: args.content,
      isAudio: args.isAudio ?? false,
    });

    if (res.needsRating) {
      return { turnCount: res.turnCount, needsRating: true, nextQuestion: null };
    }

    // 2) Fetch history to generate counter-question
    const session: any = await ctx.runQuery(internal.feynman.getSessionInternal, { sessionId: args.sessionId });
    const turns: any[] = await ctx.runQuery(internal.feynman.listTurnsInternal, { sessionId: args.sessionId });

    const topic = session.topic as string;
    const history = turns
      .filter((t) => t.role !== "system")
      .map((t) => ({
        role: (t.role === "user" ? "user" : "ai") as "user" | "ai",
        content: t.content as string,
      }));

    // Dynamic import to avoid circular deps at top-level
    const { generateCounterQuestionLLM } = await import("./ai");
    const q = await generateCounterQuestionLLM({
      topic,
      history,
      turnCount: session.turnCount as number,
      lastExplanation: args.content,
    });

    // 3) Save AI question turn + update session currentQuestion
    await ctx.runMutation(internal.feynman.saveAiQuestionInternal, {
      sessionId: args.sessionId,
      question: q,
    });

    return { turnCount: res.turnCount, needsRating: false, nextQuestion: q };
  },
});

// Internal helpers for the action
export const submitExplanationInternal = internalMutation({
  args: {
    sessionId: v.id("feynmanSessions"),
    playerId: v.id("players"),
    content: v.string(),
    isAudio: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.playerId !== args.playerId) throw new Error("Not your session");
    if (session.status !== "active") throw new Error("Session not active");
    const trimmed = args.content.trim().slice(0, 4000);
    if (trimmed.length < 10) throw new Error("Explanation too short");
    await ctx.db.insert("feynmanTurns", {
      sessionId: args.sessionId,
      role: "user",
      content: trimmed,
      isAudio: args.isAudio ?? false,
      createdAt: Date.now(),
    });
    const nextTurnCount = session.turnCount + 1;
    if (nextTurnCount >= session.maxTurns) {
      await ctx.db.patch(args.sessionId, { turnCount: nextTurnCount, currentQuestion: undefined });
      return { turnCount: nextTurnCount, needsRating: true };
    } else {
      await ctx.db.patch(args.sessionId, { turnCount: nextTurnCount, currentQuestion: "__generating__" });
      return { turnCount: nextTurnCount, needsRating: false };
    }
  },
});

export const saveAiQuestionInternal = internalMutation({
  args: { sessionId: v.id("feynmanSessions"), question: v.string() },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) throw new Error("Session not found");
    await ctx.db.insert("feynmanTurns", {
      sessionId: args.sessionId,
      role: "ai_question",
      content: args.question,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.sessionId, { currentQuestion: args.question });
  },
});

export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("feynmanSessions") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) throw new Error("Not found");
    return s;
  },
});
export const listTurnsInternal = internalQuery({
  args: { sessionId: v.id("feynmanSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.query("feynmanTurns").withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId)).collect();
  },
});

// Final rating — analyzes full loop, awards XP, updates level
export const rateSession = action({
  args: {
    sessionId: v.id("feynmanSessions"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args): Promise<{ score: number; xpAwarded: number; leveledUp: boolean; newLevel: number }> => {
    const session: any = await ctx.runQuery(internal.feynman.getSessionInternal, { sessionId: args.sessionId });
    if (!session) throw new Error("Session not found");
    if (session.playerId !== args.playerId) throw new Error("Not your session");
    if (session.status !== "active") throw new Error("Already rated/abandoned");

    const turns: any[] = await ctx.runQuery(internal.feynman.listTurnsInternal, { sessionId: args.sessionId });
    const userExplanations = turns.filter((t) => t.role === "user").map((t) => t.content as string);
    const aiQuestions = turns.filter((t) => t.role === "ai_question").map((t) => t.content as string);

    if (userExplanations.length === 0) throw new Error("No explanations to rate");

    const { rateSessionLLM } = await import("./ai");
    const result = await rateSessionLLM({
      topic: session.topic as string,
      explanations: userExplanations,
      questions: aiQuestions,
    });

    // Apply XP/level — via mutation so it's transactional
    const applied: { newLevel: number; leveledUp: boolean; xpLeft: number } = await ctx.runMutation(
      internal.feynman.applyRatingInternal,
      {
        sessionId: args.sessionId,
        playerId: args.playerId,
        score: result.score,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        feedback: result.feedback,
        xpAwarded: result.xpAwarded,
      },
    );

    // Optionally also store into explanations table for leaderboard/history?
    // Insert a summary explanation row so existing UI still sees it
    try {
      await ctx.runMutation(internal.feynman.insertExplanationSummaryInternal, {
        sessionId: args.sessionId,
        playerId: args.playerId,
        topic: session.topic,
        content: userExplanations.join("\n\n---\n\n"),
        score: result.score,
        feedback: result.feedback,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        xpAwarded: result.xpAwarded,
      });
    } catch {}

    return { score: result.score, xpAwarded: result.xpAwarded, leveledUp: applied.leveledUp, newLevel: applied.newLevel };
  },
});

export const applyRatingInternal = internalMutation({
  args: {
    sessionId: v.id("feynmanSessions"),
    playerId: v.id("players"),
    score: v.number(),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    feedback: v.string(),
    xpAwarded: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    const { level, xp, leveledUp } = computeLevelUp(player.level, player.xp, args.xpAwarded);

    await ctx.db.patch(args.playerId, {
      level,
      xp,
      totalExplanations: (player.totalExplanations ?? 0) + 1,
      // rolling avg
      avgScore:
        player.totalExplanations && player.totalExplanations > 0
          ? Math.round((player.avgScore * player.totalExplanations + args.score) / (player.totalExplanations + 1))
          : args.score,
    });

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      score: args.score,
      strengths: args.strengths,
      weaknesses: args.weaknesses,
      feedback: args.feedback,
      xpAwarded: args.xpAwarded,
      leveledUp,
      levelAfter: level,
      completedAt: Date.now(),
      currentQuestion: undefined,
    });

    // Also log final ai feedback as a turn for history rendering
    await ctx.db.insert("feynmanTurns", {
      sessionId: args.sessionId,
      role: "ai_feedback",
      content: `Score ${args.score}/100 — ${args.feedback}`,
      createdAt: Date.now(),
    });

    return { newLevel: level, leveledUp, xpLeft: xp };
  },
});

export const insertExplanationSummaryInternal = internalMutation({
  args: {
    sessionId: v.id("feynmanSessions"),
    playerId: v.id("players"),
    topic: v.string(),
    content: v.string(),
    score: v.number(),
    feedback: v.string(),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    xpAwarded: v.number(),
  },
  handler: async (ctx, args) => {
    // Try to find a matching topicId by title, else create a lightweight placeholder? For now skip if not found.
    const topicDoc = await ctx.db
      .query("topics")
      .withIndex("by_category", (q) => q.eq("category", "custom"))
      .take(20)
      .then((list) => list.find((t) => t.title.toLowerCase() === args.topic.toLowerCase()))
      .catch(() => null);
    // Search broader
    let topicId: any = topicDoc?._id ?? null;
    if (!topicId) {
      const all = await ctx.db.query("topics").take(50);
      const hit = all.find((t) => t.title.toLowerCase() === args.topic.toLowerCase());
      if (hit) topicId = hit._id;
    }
    // If still not found, we skip inserting into explanations (optional)
    if (!topicId) return null;
    return await ctx.db.insert("explanations", {
      playerId: args.playerId,
      topicId,
      targetType: "npc",
      content: args.content.slice(0, 4000),
      score: args.score,
      feedback: args.feedback,
      strengths: args.strengths,
      weaknesses: args.weaknesses,
      xpAwarded: args.xpAwarded,
      leveledUp: false,
      status: "scored",
      createdAt: Date.now(),
    });
  },
});

// Queries for UI
export const getSession = query({
  args: { sessionId: v.id("feynmanSessions") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) return null;
    const turns = await ctx.db
      .query("feynmanTurns")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    // sort by creationTime (insertion order)
    turns.sort((a, b) => a._creationTime - b._creationTime);
    return { session: s, turns };
  },
});

export const listSessions = query({
  args: { playerId: v.id("players"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const lim = Math.min(args.limit ?? 10, 50);
    const rows = await ctx.db
      .query("feynmanSessions")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .order("desc")
      .take(lim);
    return rows;
  },
});

export const getActiveSession = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("feynmanSessions")
      .withIndex("by_playerId_and_status", (q) => q.eq("playerId", args.playerId).eq("status", "active"))
      .order("desc")
      .take(1);
    const s = active[0] ?? null;
    if (!s) return null;
    const turns = await ctx.db
      .query("feynmanTurns")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", s._id))
      .collect();
    turns.sort((a, b) => a._creationTime - b._creationTime);
    return { session: s, turns };
  },
});

export const abandonSession = mutation({
  args: { sessionId: v.id("feynmanSessions"), playerId: v.id("players") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) throw new Error("Not found");
    if (s.playerId !== args.playerId) throw new Error("Not yours");
    if (s.status !== "active") return;
    await ctx.db.patch(args.sessionId, { status: "abandoned", completedAt: Date.now() });
  },
});
