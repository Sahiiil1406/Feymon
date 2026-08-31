import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lim = Math.min(args.limit ?? 20, 50);
    if (args.category) {
      return await ctx.db
        .query("topics")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .take(lim);
    }
    return await ctx.db.query("topics").take(lim);
  },
});

export const get = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.topicId);
  },
});
