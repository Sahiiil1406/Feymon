import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Kept from template but unused now - can keep or remove later
  tasks: defineTable({
    title: v.string(),
    completed: v.boolean(),
  }),

  players: defineTable({
    name: v.string(),
    sprite: v.string(), // e.g. "hero_0" .. "hero_3" pokemon-style palette
    color: v.string(), // hex fallback
    level: v.number(),
    xp: v.number(),
    totalExplanations: v.number(),
    avgScore: v.number(),
    createdAt: v.number(),
  })
    .index("by_level", ["level"])
    .index("by_name", ["name"]),

  // High-churn presence + position separated from stable profile (per guidelines)
  playerPresence: defineTable({
    playerId: v.id("players"),
    x: v.number(),
    y: v.number(),
    direction: v.union(
      v.literal("up"),
      v.literal("down"),
      v.literal("left"),
      v.literal("right"),
    ),
    mapId: v.string(),
    isOnline: v.boolean(),
    lastSeen: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_online_and_lastSeen", ["isOnline", "lastSeen"])
    .index("by_mapId", ["mapId"]),

  topics: defineTable({
    title: v.string(),
    category: v.string(), // science, math, history, cs, etc
    difficulty: v.number(), // 1-5
    prompt: v.string(), // The Feynman challenge: "Explain X to a 12 year old"
    description: v.string(),
    starterHint: v.optional(v.string()),
  })
    .index("by_category", ["category"])
    .index("by_difficulty", ["difficulty"]),

  npcs: defineTable({
    name: v.string(),
    role: v.string(), // e.g. "Professor", "Curious Kid", "Rival"
    personality: v.string(),
    topicId: v.id("topics"),
    x: v.number(),
    y: v.number(),
    mapId: v.string(),
    sprite: v.string(),
    introLine: v.string(),
    color: v.string(),
  })
    .index("by_topicId", ["topicId"])
    .index("by_mapId", ["mapId"]),

  explanations: defineTable({
    playerId: v.id("players"),
    topicId: v.id("topics"),
    npcId: v.optional(v.id("npcs")),
    targetType: v.union(v.literal("npc"), v.literal("player")),
    targetId: v.optional(v.string()), // stringified Id for polymorphic (npcId or playerId)
    content: v.string(),
    score: v.optional(v.number()), // 0-100, null until judged
    feedback: v.optional(v.string()),
    strengths: v.optional(v.array(v.string())),
    weaknesses: v.optional(v.array(v.string())),
    xpAwarded: v.optional(v.number()),
    leveledUp: v.optional(v.boolean()),
    newLevel: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("judging"),
      v.literal("scored"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_topicId", ["topicId"])
    .index("by_playerId_and_topicId", ["playerId", "topicId"])
    .index("by_status", ["status"]),

  worldMessages: defineTable({
    authorId: v.id("players"),
    authorName: v.string(),
    body: v.string(),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    mapId: v.string(),
    // proximity chat: only players within range see? For MVP global per map
    channel: v.union(v.literal("world"), v.literal("nearby"), v.literal("npc")),
  }).index("by_mapId", ["mapId"]),

  // Direct / nearby player-to-player chats (for 1:1 Feynman peer sessions)
  directMessages: defineTable({
    fromId: v.id("players"),
    toId: v.id("players"),
    body: v.string(),
  })
    .index("by_fromId", ["fromId"])
    .index("by_toId", ["toId"])
    .index("by_conversation", ["fromId", "toId"]),

  // Seed tracking for idempotency
  seedMeta: defineTable({
    key: v.string(),
    at: v.number(),
  }).index("by_key", ["key"]),

  // === Feynman AI Loop ===
  feynmanSessions: defineTable({
    playerId: v.id("players"),
    topic: v.string(),
    topicCategory: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("abandoned"),
    ),
    turnCount: v.number(), // user turns so far
    maxTurns: v.number(), // e.g. 5 loops before rating
    currentQuestion: v.optional(v.string()),
    // Final rating
    score: v.optional(v.number()), // 0-100
    strengths: v.optional(v.array(v.string())),
    weaknesses: v.optional(v.array(v.string())),
    feedback: v.optional(v.string()),
    xpAwarded: v.optional(v.number()),
    leveledUp: v.optional(v.boolean()),
    levelBefore: v.number(),
    levelAfter: v.optional(v.number()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_playerId", ["playerId"])
    .index("by_playerId_and_status", ["playerId", "status"])
    .index("by_status", ["status"]),

  feynmanTurns: defineTable({
    sessionId: v.id("feynmanSessions"),
    role: v.union(
      v.literal("user"),
      v.literal("ai_question"),
      v.literal("ai_feedback"),
      v.literal("system"),
    ),
    content: v.string(),
    isAudio: v.optional(v.boolean()), // true if from Web Speech API
    createdAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),
});
