import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Simple name-only auth for Feymon — Convex-native, no external provider.
 *
 * - Client stores `playerId` + `name` in localStorage (lib/playerStorage.ts).
 * - Same name (case-insensitive) → same player document → same progression (level/xp/avgScore).
 * - Character (sprite/color) is deterministic: hash(name) → SPRITES/COLORS (see players.ts: spriteForName/colorForName).
 * - No password, no OAuth. Suitable for hackathon demo; swap to @convex-dev/auth for prod.
 */

// Verify name → player (for progression restore)
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim();
    if (trimmed.length < 2) return null;
    const lower = trimmed.toLowerCase();
    const byExact = await ctx.db
      .query("players")
      .withIndex("by_name", (q) => q.eq("name", trimmed))
      .unique()
      .catch(() => null);
    if (byExact) return byExact;
    const all = await ctx.db.query("players").collect();
    return all.find((p) => p.name.toLowerCase() === lower) ?? null;
  },
});

// Current auth state — just confirms the stored playerId is still valid
export const me = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) return null;
    return player;
  },
});
