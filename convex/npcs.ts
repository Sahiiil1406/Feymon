import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { mapId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.mapId) {
      return await ctx.db
        .query("npcs")
        .withIndex("by_mapId", (q) => q.eq("mapId", args.mapId!))
        .collect();
    }
    return await ctx.db.query("npcs").take(50);
  },
});

export const get = query({
  args: { npcId: v.id("npcs") },
  handler: async (ctx, args) => {
    const npc = await ctx.db.get(args.npcId);
    if (!npc) return null;
    const topic = await ctx.db.get(npc.topicId);
    return { npc, topic };
  },
});
