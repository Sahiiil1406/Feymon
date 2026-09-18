import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const SPRITES = ["hero_blue", "hero_red", "hero_green", "hero_girl"] as const;
const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"] as const;

const MAP_SPAWN: Record<string, { x: number; y: number }> = {
  overworld: { x: 656, y: 1150 },
  village: { x: 200, y: 200 },
  town: { x: 656, y: 1150 },
};

// Deterministic mapping — same name → same sprite/color → progression is tied to name
function hashName(name: string): number {
  let h = 0;
  const s = name.toLowerCase().trim();
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
function spriteForName(name: string): string {
  return SPRITES[hashName(name) % SPRITES.length]!;
}
function colorForName(name: string): string {
  // offset hash so color and sprite don't always pair the same way
  return COLORS[hashName(name + "_color") % COLORS.length]!;
}

// Create account - idempotent by name (for demo). In prod use auth.
export const create = mutation({
  args: {
    name: v.string(),
    sprite: v.optional(v.string()),
    color: v.optional(v.string()),
    mapId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim().slice(0, 20);
    if (trimmed.length < 2) throw new Error("Name must be at least 2 characters");
    if (trimmed.length > 20) throw new Error("Name too long");

    // Simple name-only auth — same name → same player → progression saved
    // 1) try exact match via index (fast path)
    let existing = await ctx.db
      .query("players")
      .withIndex("by_name", (q) => q.eq("name", trimmed))
      .unique()
      .catch(() => null);

    // 2) case-insensitive fallback so "Ash" and "ash" map to same progression
    if (!existing) {
      const trimmedLower = trimmed.toLowerCase();
      const candidates = await ctx.db.query("players").withIndex("by_name").collect();
      existing = candidates.find((p) => p.name.toLowerCase() === trimmedLower) ?? null;
      // small full-scan fallback if index miss (covers old data)
      if (!existing) {
        const all = await ctx.db.query("players").collect();
        existing = all.find((p) => p.name.toLowerCase() === trimmedLower) ?? null;
      }
    }

    // If exists, reuse — progression (level/xp) stays tied to name
    if (existing) {
      // ensure presence row exists / mark online
      const presence = await ctx.db
        .query("playerPresence")
        .withIndex("by_playerId", (q) => q.eq("playerId", existing._id))
        .unique()
        .catch(() => null);

      const spawn = MAP_SPAWN[args.mapId ?? "overworld"] ?? MAP_SPAWN.overworld;
      if (!presence) {
        await ctx.db.insert("playerPresence", {
          playerId: existing._id,
          x: spawn.x,
          y: spawn.y,
          direction: "down",
          mapId: args.mapId ?? "overworld",
          isOnline: true,
          lastSeen: Date.now(),
        });
      } else {
        await ctx.db.patch(presence._id, {
          isOnline: true,
          lastSeen: Date.now(),
        });
      }
      return existing._id;
    }

    // Deterministic character based on name — same name always yields same sprite/color
    const playerId = await ctx.db.insert("players", {
      name: trimmed,
      sprite: args.sprite ?? spriteForName(trimmed),
      color: args.color ?? colorForName(trimmed),
      level: 1,
      xp: 0,
      totalExplanations: 0,
      avgScore: 0,
      createdAt: Date.now(),
    });

    const spawn = MAP_SPAWN[args.mapId ?? "overworld"] ?? MAP_SPAWN.overworld;
    await ctx.db.insert("playerPresence", {
      playerId,
      x: spawn.x,
      y: spawn.y,
      direction: "down",
      mapId: args.mapId ?? "overworld",
      isOnline: true,
      lastSeen: Date.now(),
    });

    return playerId;
  },
});

export const get = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) return null;
    const presence = await ctx.db
      .query("playerPresence")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique()
      .catch(() => null);
    return { player, presence };
  },
});

export const listOnline = query({
  args: {
    mapId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const presences = await ctx.db
      .query("playerPresence")
      .withIndex("by_online_and_lastSeen", (q) => q.eq("isOnline", true))
      .collect();

    // Filter by map if requested
    const filtered = args.mapId
      ? presences.filter((p) => p.mapId === args.mapId)
      : presences;

    // Hydrate player docs - bounded: online count is naturally small (<100)
    const results = [];
    for (const pres of filtered) {
      const player = await ctx.db.get(pres.playerId);
      if (!player) continue;
      results.push({ player, presence: pres });
    }
    return results;
  },
});

export const heartbeat = mutation({
  args: {
    playerId: v.id("players"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    direction: v.optional(
      v.union(
        v.literal("up"),
        v.literal("down"),
        v.literal("left"),
        v.literal("right"),
      ),
    ),
    mapId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("playerPresence")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();

    if (!presence) throw new Error("Presence not found - create player first");

    const now = Date.now();
    // Avoid write contention with move() which already updates lastSeen every ~70ms.
    // If no position change and lastSeen is fresh (<4s), skip.
    const hasPosUpdate = args.x !== undefined || args.y !== undefined || args.direction || args.mapId;
    if (!hasPosUpdate && now - presence.lastSeen < 4000 && presence.isOnline) {
      return;
    }

    const patch: Record<string, unknown> = {
      isOnline: true,
      lastSeen: now,
    };
    if (args.x !== undefined) patch.x = Math.max(0, Math.min(1600, args.x));
    if (args.y !== undefined) patch.y = Math.max(0, Math.min(1200, args.y));
    if (args.direction) patch.direction = args.direction;
    if (args.mapId) patch.mapId = args.mapId;

    await ctx.db.patch(presence._id, patch as any);
  },
});

export const move = mutation({
  args: {
    playerId: v.id("players"),
    x: v.number(),
    y: v.number(),
    direction: v.union(
      v.literal("up"),
      v.literal("down"),
      v.literal("left"),
      v.literal("right"),
    ),
    mapId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("playerPresence")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();

    if (!presence) throw new Error("Presence not found");

    await ctx.db.patch(presence._id, {
      x: Math.max(16, Math.min(1584, args.x)),
      y: Math.max(16, Math.min(1184, args.y)),
      direction: args.direction,
      mapId: args.mapId ?? presence.mapId,
      isOnline: true,
      lastSeen: Date.now(),
    });
  },
});

export const setOffline = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("playerPresence")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique()
      .catch(() => null);
    if (!presence) return;
    await ctx.db.patch(presence._id, { isOnline: false, lastSeen: Date.now() });
  },
});

// Cron helper: mark stale offline (>30s)
export const markStaleOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30_000;
    const stale = await ctx.db
      .query("playerPresence")
      .withIndex("by_online_and_lastSeen", (q) =>
        q.eq("isOnline", true).lt("lastSeen", cutoff),
      )
      .take(100);
    for (const p of stale) {
      await ctx.db.patch(p._id, { isOnline: false });
    }
    return { marked: stale.length };
  },
});
