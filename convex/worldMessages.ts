import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    mapId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lim = Math.min(args.limit ?? 50, 100);
    if (args.mapId) {
      return await ctx.db
        .query("worldMessages")
        .withIndex("by_mapId", (q) => q.eq("mapId", args.mapId!))
        .order("desc")
        .take(lim);
    }
    return await ctx.db.query("worldMessages").order("desc").take(lim);
  },
});

export const send = mutation({
  args: {
    authorId: v.id("players"),
    body: v.string(),
    mapId: v.optional(v.string()),
    channel: v.optional(
      v.union(v.literal("world"), v.literal("nearby"), v.literal("npc")),
    ),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.body.trim().slice(0, 300);
    if (trimmed.length === 0) throw new Error("Message cannot be empty");
    if (trimmed.length > 300) throw new Error("Message too long");

    const player = await ctx.db.get(args.authorId);
    if (!player) throw new Error("Player not found");

    // Rate limit: max 1 msg per 800ms per player - check last message
    const recent = await ctx.db
      .query("worldMessages")
      .order("desc")
      .take(10);
    const lastByAuthor = recent.find((m) => m.authorId === args.authorId);
    if (lastByAuthor && Date.now() - lastByAuthor._creationTime < 800) {
      throw new Error("You're sending messages too fast");
    }

    const id = await ctx.db.insert("worldMessages", {
      authorId: args.authorId,
      authorName: player.name,
      body: trimmed,
      mapId: args.mapId ?? "overworld",
      channel: args.channel ?? "world",
      x: args.x,
      y: args.y,
    });

    // Keep table bounded: prune oldest beyond 500 per map (async not needed now)
    return id;
  },
});

export const listDirect = query({
  args: {
    playerId: v.id("players"),
    peerId: v.id("players"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lim = Math.min(args.limit ?? 50, 100);
    const all = await ctx.db.query("directMessages").order("desc").take(200);
    const convo = all.filter(
      (m) =>
        (m.fromId === args.playerId && m.toId === args.peerId) ||
        (m.fromId === args.peerId && m.toId === args.playerId),
    );
    return convo.slice(0, lim).reverse();
  },
});

export const sendDirect = mutation({
  args: {
    fromId: v.id("players"),
    toId: v.id("players"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmed = args.body.trim().slice(0, 500);
    if (trimmed.length === 0) throw new Error("Empty message");
    const from = await ctx.db.get(args.fromId);
    const to = await ctx.db.get(args.toId);
    if (!from || !to) throw new Error("Player not found");
    return await ctx.db.insert("directMessages", {
      fromId: args.fromId,
      toId: args.toId,
      body: trimmed,
    });
  },
});
