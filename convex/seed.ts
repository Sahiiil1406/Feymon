import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seed = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const existingMeta = await ctx.db
      .query("seedMeta")
      .withIndex("by_key", (q) => q.eq("key", "v1"))
      .unique()
      .catch(() => null);

    if (existingMeta && !args.force) {
      return { status: "already_seeded", at: existingMeta.at };
    }

    // Clear existing if force
    if (args.force) {
      for (const tbl of ["topics", "npcs"] as const) {
        const docs = await ctx.db.query(tbl).take(200);
        for (const d of docs) await ctx.db.delete(tbl, d._id);
      }
    } else {
      const topicCount = (await ctx.db.query("topics").take(1)).length;
      if (topicCount > 0) return { status: "already_seeded" };
    }

    const topics = [
      {
        title: "Photosynthesis",
        category: "science",
        difficulty: 2,
        prompt: "Explain photosynthesis to a 10-year-old so they never forget it.",
        description: "How plants make food from sunlight.",
        starterHint: "Think: sunlight + water + CO2 -> sugar + oxygen",
      },
      {
        title: "Recursion",
        category: "cs",
        difficulty: 3,
        prompt: "Explain recursion like I'm a beginner who only knows loops.",
        description: "A function that calls itself with a base case.",
        starterHint: "Use the mirror-in-mirror analogy, then show factorial.",
      },
      {
        title: "Black Holes",
        category: "science",
        difficulty: 3,
        prompt: "Explain why nothing escapes a black hole, without jargon.",
        description: "Gravity so strong even light can't escape.",
        starterHint: "Compare escape velocity to a trampoline well.",
      },
      {
        title: "Supply & Demand",
        category: "economics",
        difficulty: 2,
        prompt: "Explain supply and demand using a Pokemon card market.",
        description: "Price moves where supply meets demand.",
        starterHint: "Rare Charizard + many buyers = price up",
      },
      {
        title: "Neural Networks",
        category: "cs",
        difficulty: 4,
        prompt: "Explain neural networks using a team of novices guessing an answer.",
        description: "Layers of simple units learning patterns.",
        starterHint: "Input -> hidden detectives -> output guesser",
      },
    ];

    const topicIds: Record<string, any> = {};
    for (const t of topics) {
      const id = await ctx.db.insert("topics", t);
      topicIds[t.title] = id;
    }

    const npcs = [
      {
        name: "Prof. Oak",
        role: "Village Professor",
        personality: "Warm, encouraging, loves analogies. Speaks like Pokemon Prof Oak.",
        topicId: topicIds["Photosynthesis"],
        x: 520,
        y: 260,
        mapId: "overworld",
        sprite: "npc_oak",
        introLine: "Ah! A new trainer! Want to try the Feynman trial? Explain PHOTOSYNTHESIS to me like I'm 10!",
        color: "#92400e",
      },
      {
        name: "Curious Maya",
        role: "Kid Explorer",
        personality: "Curious 11-year-old, asks innocent 'but why?' follow-ups.",
        topicId: topicIds["Recursion"],
        x: 760,
        y: 420,
        mapId: "overworld",
        sprite: "npc_kid",
        introLine: "I know loops... but recursion sounds like magic? Can you teach me?",
        color: "#db2777",
      },
      {
        name: "Rival Kai",
        role: "Rival",
        personality: "Competitive but fair. Will judge you hard like a rival battle.",
        topicId: topicIds["Supply & Demand"],
        x: 340,
        y: 560,
        mapId: "overworld",
        sprite: "npc_rival",
        introLine: "Heh, bet you can't explain Supply & Demand with Pokemon cards. Try me!",
        color: "#1f2937",
      },
      {
        name: "Stargazer Nova",
        role: "Observatory Keeper",
        personality: "Dreamy, poetic, loves space. Gentle judge.",
        topicId: topicIds["Black Holes"],
        x: 1080,
        y: 300,
        mapId: "overworld",
        sprite: "npc_nova",
        introLine: "The stars hide a secret... why does even light get trapped? Tell me, traveler.",
        color: "#4f46e5",
      },
      {
        name: "Coder Lin",
        role: "Lab Hacker",
        personality: "Fast-talking coder, loves hacks. Referenced AI & JS stack.",
        topicId: topicIds["Neural Networks"],
        x: 900,
        y: 700,
        mapId: "overworld",
        sprite: "npc_lin",
        introLine: "Yo! Neural nets are just stacked guessers. Prove you can explain it simply?",
        color: "#059669",
      },
      {
        name: "Nurse Joy",
        role: "Healer",
        personality: "Kind, healing center nurse. Tutorial NPC, no judge yet.",
        topicId: topicIds["Photosynthesis"],
        x: 200,
        y: 200,
        mapId: "overworld",
        sprite: "npc_joy",
        introLine: "Welcome to Feymon Center! Heal up, then talk to Prof. Oak near the oak tree!",
        color: "#e11d48",
      },
    ];

    for (const n of npcs) await ctx.db.insert("npcs", n);

    await ctx.db.insert("seedMeta", { key: "v1", at: Date.now() });

    return {
      status: "seeded",
      topics: topics.length,
      npcs: npcs.length,
    };
  },
});
