# Feymon — Feynman Metaverse Plaza

> **Learn by explaining. Evolve your avatar.**
> A live 2D plaza where you explain any topic to an AI sensei, get scored 1–10, and evolve — unlocking skins, auras and regions. Walk, talk, get challenged, get rated, level up.

**Live app:** https://graceful-buzzard-759.convex.site · **Repo:** https://github.com/Sahiiil1406/Aevora · **Convex:** https://graceful-buzzard-759.convex.cloud  
**Hackathon:** [Convex All Gas](https://www.convex.dev/hackathons/all-gas) · Kickoff Aug 25 → Submissions Sep 22 12:00 PM PT · Build log `hackathon.md` at root

---

## What it does

Feymon turns the **Feynman technique** — “if you can’t explain it simply, you don’t understand it” — into a living game.

It looks like a cozy Pokémon FireRed village, but every villager is an AI tutor and every building is a learning space. You arrive at level 1, you wander, you get stopped by curious characters who want you to *teach them*. You step into the Dojo at the center of town, choose anything — *Photosynthesis, Recursion, Black Holes, Supply & Demand, Neural Networks, or your own custom topic like “Explain blockchain to my mom”* — and you have to make it click for a 12-year-old.

The AI doesn’t just nod. It Socratically pokes holes, hunts jargon, and asks the “but why?” you skipped. After a short loop it scores you honestly, tells you exactly what was clear and what was fuzzy, and gives you XP. Your avatar visibly evolves — new skins, auras, regions like Desert Outpost unlock as you climb. Learning becomes a place you want to return to, not a quiz you endure.

**Who it’s for:**
- Students who memorize definitions but freeze when asked “why?”
- Teachers testing if their analogy actually lands
- Teams onboarding to a new domain who need to turn “kind of gets it” into “can teach it”
- Anyone who wants the addictive loop of a game with the payload of real understanding

**Example 60-second loop:**
> You: *“Photosynthesis is like a plant cooking with sunlight — leaves are the kitchen, sunlight is the heat, CO₂ and water are ingredients, sugar is the meal, oxygen is the smell.”*  
> Sensei: *“Nice kitchen! But if the plant’s ‘stove’ is the chlorophyll, what happens if you turn off the sunlight — does the kitchen still work at night?”*  
> You clarify, it parries again, then you get: **7.2/10 — strengths: vivid analogy, stayed simple; weaknesses: skipped why oxygen leaves; feedback: add what the plant does with sugar next time; +38 XP → Level 3!**

**One-liner:** *Explain anything to an AI sensei, get scored, and watch your avatar evolve.*

---

## How it does

### The village flow

```
plaza ──► dojo ──► score ──► evolve ──► share ──► exhibit
  │        │
  │        └─ 1. Pick topic (5 seeded + any custom, 120 chars max)
  │            2. Explain — “teach a 12-year-old, use an analogy” (type or hold SPEAK)
  │            3. AI asks a counter-question — you clarify, it parries again
  │            4. After 4 turns (configurable 2–8) → GET RATED → score + feedback + XP → level-up toast
  │            5. Share — result card shows “I scored 7.2 on Photosynthesis — try to beat me!” + live link → Copy / X / LinkedIn / native share
  │            6. History stays — see turns, strengths, weaknesses, past sessions
  └─ Between: walk with WASD/Arrows, Enter to talk or enter/exit Dojo, click NPCs or doors, chat nearby/world, watch minimap
```

### Session lifecycle (what happens behind the scenes)

1. **Start session — you choose the topic**  
   The app creates a fresh learning session for you. It caps the topic length, closes any old active session you left hanging, and plants the first prompt: *“Explain ___ in your own words — imagine you’re teaching a curious 12-year-old. Use an analogy!”* That prompt is also saved as the first turn so your history is complete from the start.

2. **Explain & counter — the loop**  
   Every time you submit an explanation (typed or voice-transcribed), it’s saved as a user turn. The turn counter goes up. If you haven’t hit the max turns yet, the AI immediately generates the next Socratic counter-question — one sharp, 1–2 sentence “what if / why” that hunts the jargon or gap you just left. That question is saved as an ai_question turn and shown as the next prompt. Your input stays “generating…” for a beat, then the new question drops. If you’ve hit the max turns, the session flips to “ready to rate” instead.

3. **Get rated — the payoff**  
   The AI reads your entire loop — all your explanations and its questions — and returns structured JSON: a score 0–100 (shown as 1–10), 2–3 strengths, 2–3 weaknesses, 2–4 sentences of feedback, and XP. The app then applies XP with a level curve of `100 × level` (level 1 needs 100 XP, level 2 needs 200, etc.), updates your total explanations and rolling average score, marks the session completed, and logs a final feedback turn so you can scroll the whole story. A shareable result card appears immediately with “I scored 7.2 on Photosynthesis — try to beat me!” + the live link + Copy / X / LinkedIn / native share + Grounded badge.

4. **Share — the proof**  
   One tap copies `“I scored 7.2 on Photosynthesis in Feymon — try to beat me! https://graceful-buzzard-759.convex.site”` or opens X/LinkedIn intent. It’s built for social proof — judges see you’ve shipped something shareable, friends can jump straight into the live plaza.

5. **Between sessions — the world stays live**  
   You’re never kicked back to a form. You’re still in the plaza. You can click another NPC for a fresh challenge line, open the Dojo again with a new topic, or just wander and chat. Presence and messages are live — no refresh needed.

### Scoring rubric (what the AI judges)

- **Clarity** — could a 12-year-old follow it without a dictionary?
- **Correctness** — are the core mechanism and examples right? (Firecrawl grounding helps here)
- **Simplicity** — did you use an everyday analogy instead of jargon?
- **Depth** — did you handle the counter-questions or dodge them?
- **Flow** — did you build across turns or repeat yourself?

Score → XP → level → unlock. Low scores aren’t punishment; they point to the exact analogy to fix.

---

## Features

### Live 2D world
Explore a HD pixel-art village (1280×720, smooth zoom) that feels like FireRed. Movement is optimistic — you move instantly, the server reconciles gently (you only teleport if you drift far). Houses, paths, water, trees and collision feel solid, depth sorting keeps sprites natural, and chat bubbles float above heads. It’s a place, not a page.

**What it does for you:** You feel *present*. You learn by wandering and being approached, not by clicking a dropdown.

### Realtime presence
See who’s online right now, where they are on the minimap (with smooth 0.18s transitions), and what they’re typing. Chat has world and nearby channels. If someone closes the tab or their connection drops, they’re automatically marked offline within ~30 seconds — no ghost avatars.

**What it does for you:** The plaza feels alive. You know when a friend is nearby to challenge, and you never have to refresh to see the world.

### LLM-powered NPCs
Each villager is a distinct LLM persona. The system builds a tailored prompt per NPC: name + role + personality + topic specialty (title + prompt) + player name and level + a random 5-char nonce seed for variation. The system instruction locks output to 1–2 sentences, max 42 words, in-character, warm and curious, Feynman-style (analogy for a 10-year-old, no jargon), and asks for *only* the dialogue line with no quotes or stage directions. The user prompt is just “generate the greeting now — one fresh intro line that tees up the Feynman challenge.” On the model side it uses a provider-agnostic LLM call with temperature 0.7 and max tokens 1200, supports OpenAI chat completions and Gemini generateContent, strips echoed prefixes and trims to 220 chars / 1–2 sentences, and ensures terminal punctuation.

**What it does for you:** Every talk feels fresh and in-character — the professor teases photosynthesis differently each time, the rival always finds a new angle on supply & demand, and the Dojo sensei varies his challenge without repeating lines. You’re never asked the same prompt twice.

### Feynman Dojo
Walk through the big central building into a real interior room — wooden tatami floor, shoji partitions, pillars, four distinct NPCs. Inside, the Dojo UI takes over: topic chips (plus custom input), a draft box with interim transcription, a SPEAK button, a turn history that auto-scrolls, and a GET RATED button when you’ve hit the max turns. The Dojo fits on one screen so you never lose the plaza context.

**What it does for you:** It turns “explain” from a scary blank page into a guided, game-like loop with clear steps and visible progress.

### Audio input using Web Speech API
Voice input is built directly on the browser’s Web Speech API. It first asks for microphone permission via `getUserMedia` so the browser shows a proper prompt, then creates a `SpeechRecognition` (with `webkitSpeechRecognition` prefix for Chrome/Edge) instance configured for `lang: en-US`, `continuous: false`, `interimResults: true`. As you speak it streams interim transcripts for live preview and commits a final transcript via an `onResult(transcript, isFinal)` callback — final chunks are appended to the draft, interim is shown separately. It handles `network` hiccups with auto-clear, throttles updates around 450ms, and exposes explicit `start`/`stop` control tied to the SPEAK button plus permission states (`prompt`/`granted`/`denied`/`unsupported`).

**What it does for you:** You can talk instead of type — speak an analogy, see it appear live, then send. It’s faster for storytelling and feels like actually teaching.

### Simple name-only auth
Just a name. No password, no OAuth. The same name always yields the same sprite and color (hash-based), and the server reuses the same player document — so your level, XP and average score are restored on any device. Case-insensitive (“Ash” = “ash”), progression is tied 1:1 to name.

**What it does for you:** You can return or switch devices, type the same name, and instantly be your same character with all progress intact.

### Progression
Every rated session gives XP. The level curve is simple and transparent: `100 × level` to level up. You see a level-up toast, your avatar card shows a progress bar and unlocks (skins, auras, regions like Desert Outpost), and your past sessions keep strengths/weaknesses so you can track what improved. Your average score and total explanations persist.

**What it does for you:** You see growth. A 7.2 today becomes an 8.4 next week because you fixed the exact weakness the sensei flagged.

### Shareable result card
After you get rated, a prominent card appears with your score rendered as `score/10` (e.g., 7.2 on Photosynthesis), the topic, and the live link. It’s designed for social proof: one line ready to copy — “I scored 7.2 on Photosynthesis in Feymon — try to beat me! https://graceful-buzzard-759.convex.site” — with buttons for Copy (clipboard + textarea fallback, shows “Copied!”), Share on X (opens `twitter.com/intent/tweet` with text + URL), LinkedIn (opens `linkedin.com/sharing/share-offsite`), and native share via `navigator.share` when available. The card also carries the Grounded badge (Firecrawl vs built-in) and a hint to tag `@convex @OpenAI @firecrawl`.

**What it does for you:** You can brag and invite others in one tap. Judges see social proof without you writing a post from scratch, and friends can open the live plaza directly from your link.

### Static hosting
Frontend and backend deploy together to a public `convex.site` URL. No separate Vercel/Netlify, no CORS, no env mismatch. One atomic publish serves the whole plaza.

**What it does for you:** Judges (and friends) open one link — no login, no invite — and they’re in the live world.

---

## Which sponsor what used

| Sponsor | What it does in Feymon | How it’s used |
|---|---|---|
| **Convex** | **Runs everything** — the single source of truth for data, realtime, scheduling and hosting | Holds all tables (players, presence, topics, NPCs, sessions, turns, messages) with indexes so every query hits an index. Handles realtime subscriptions so the plaza, chat and Dojo update live. Runs a 20-second scheduled job that marks stale presence offline. Hosts the frontend and backend together on a public convex.site URL — one deploy, one URL. |
| **OpenAI** | **Generates** — the brain for questions, scoring and dialogue | Provides Socratic counter-questions after each explanation, final structured scoring (score + strengths + weaknesses + feedback + XP), and fresh NPC dialogue each talk. A provider switch lets the app run on OpenAI or Gemini with just an environment setting. In production it runs Gemini, but OpenAI via chat completions is wired the same way and verified via a health check. |
| **Firecrawl** | **Feeds grounded context** — keeps the LLM honest | Scrapes any URL to clean markdown, searches for topic URLs, and gets topic-grounded context (search → scrape top hit). That markdown is injected into LLM prompts so counter-questions and scores catch factual gaps without hallucination. Three exposed actions let you scrape a URL, search for a query, or get context for a topic. |

> Enable Firecrawl: `npx convex env set FIRECRAWL_API_KEY <key>` (add `--prod` for production).

---

## Basic architecture

```
Browser (React + Vite + Phaser)
  ├─ Game → renders the plaza and Dojo rooms
  │         handles movement (WASD/Arrows/click), collisions,
  │         depth sorting, chat bubbles and minimap
  ├─ Dojo UI → topic picker, explanation input,
  │            voice (speech → text), turn history, rating → share card (Copy/X/LinkedIn + Grounded badge)
  └─ Speech → asks mic permission, shows live transcription

Convex
  ├─ Database → players, presence, topics, NPCs, sessions, turns, messages
  │             (stable profile vs high-churn presence split, indexed queries)
  ├─ AI → LLM calls for questions, scoring and dialogue
  │       + Firecrawl scrape/search for grounded markdown context
  ├─ Sessions → creates sessions, saves turns, levels up with 100×level curve
  └─ Crons → every 20s marks offline players who stopped heartbeating

Hosting → Convex static hosting → public convex.site URL (frontend + backend together)
External → OpenAI / Gemini for generation + Firecrawl for markdown → injected into prompts
```

**Data flow — one explanation:**

1. You type or speak → the app saves your text as a user turn and bumps the turn counter.
2. If not yet at max turns, it asks the AI layer to generate the next counter-question. The AI layer optionally asks Firecrawl for markdown about the topic, injects that as grounded context, then calls the LLM. The new question is saved and shown instantly.
3. If at max turns, the app waits for you to hit GET RATED. The AI reads the full loop plus optional Firecrawl context and returns a score + feedback. Then the session is marked completed, XP is applied, and the level is updated — all live, so your avatar and history update without a refresh.
4. Share — the result card renders with `score/10` + topic + live link + Grounded badge; one tap copies `“I scored 7.2 on Photosynthesis — try to beat me! https://graceful-buzzard-759.convex.site”` or shares to X/LinkedIn/native.

**Realtime:** The frontend doesn’t poll. It subscribes to live queries for online players, messages, NPCs and the active session. When any player moves or any turn is added, every subscribed client updates automatically.

**Hosting:** The frontend build and the Convex deployment are published together atomically to the convex.site URL. There’s no separate server — what you see in the plaza is what’s in the database, live.

---
