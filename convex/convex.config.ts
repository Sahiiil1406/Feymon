import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    LLM_PROVIDER: v.optional(v.union(v.literal("openai"), v.literal("gemini"), v.literal("mock"))),
    OPENAI_API_KEY: v.optional(v.string()),
    GEMINI_API_KEY: v.optional(v.string()),
    OPENAI_MODEL: v.optional(v.string()),
    GEMINI_MODEL: v.optional(v.string()),
  },
});
export default app;
