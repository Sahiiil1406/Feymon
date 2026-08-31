import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const markOfflineStale = internalMutation({
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

const crons = cronJobs();

// Every 20 seconds mark offline stale presences (cheap, runs infrequently)
crons.interval("mark stale offline", { seconds: 20 }, internal.crons.markOfflineStale, {});

export default crons;
