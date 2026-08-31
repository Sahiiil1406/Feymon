# Hackathon log

- **Project:** Feymon
- **Event:** Convex All Gas Hackathon
- **What it does:** Open-world 2D learning game (Feynman × Pokémon FireRed) — live avatars, NPCs, realtime movement and world chat
- **Live app:** not deployed
- **Repo:** https://github.com/Sahiiil1406/Aevora
- **Frontend:** not deployed
- **Convex deployment:** https://watchful-bat-395.convex.cloud
- **Components:** none
- **Convex features:** schema, tables, indexes, queries, mutations, crons, realtime queries
- **Auth:** none
- **AI models:** none
- **Started:** 2026-08-26T15:44:36Z
- **Last updated:** 2026-08-31T22:09:36Z

## Log

### 2026-08-26 - working tree
Set up Convex integration for OpenCode (skills + MCP) and installed the hackathon build-log skill at `.agents/skills/convex-hackathon-skill/`. No Convex app code yet; project is an empty workspace awaiting `npx convex` init and frontend hosting setup. Convex features: none yet (no `convex/` directory). Frontend pending confirmation: defaulting to Convex static hosting per cross-agent recommendation.

### 2026-08-26 - working tree
Initialized Vite React-TS app (vite@8.2.2, react@19, vite.config.ts) and Convex backend (convex@1.45.0) with `convex/schema.ts` (tasks table), `convex/tasks.ts` (list/create/toggle queries/mutations), and `convex/convex.config.ts`. Wired `src/main.tsx` with `ConvexProvider` and `src/App.tsx` with realtime `useQuery`/`useMutation` tasks UI (fallback when VITE_CONVEX_URL missing). Verified `npm run build` succeeds. Convex features: schema, tables, query, mutation, realtime queries (`convex/schema.ts`, `convex/tasks.ts`, `src/App.tsx`).

### 2026-08-26 - working tree
Installed Phaser 4.2.1 for 2-D open world game (`phaser@^4.2.1` in `package.json`, `package-lock.json`). Verified `npx tsc --noEmit` and `npm run build` still pass with Phaser types available for `Phaser.Types.Core.GameConfig`. No Convex feature change; realtime queries and schema remain as before.

### 2026-08-31 - working tree
Built Feynman × FireRed open-world backend: 8 tables with high-churn split (`players` stable + `playerPresence` x/y/direction/mapId/isOnline/lastSeen) and indexes `by_playerId`, `by_online_and_lastSeen` (`convex/schema.ts`). Added `convex/players.ts` (create/get/listOnline/heartbeat/move/setOffline), `convex/npcs.ts`, `convex/topics.ts`, `convex/worldMessages.ts` (world/nearby + directMessages), `convex/seed.ts` (5 topics + 6 NPCs: Oak/Maya/Kai/Nova/Lin/Joy) and `convex/crons.ts` (20s `markOfflineStale` internalMutation). Fixed `_generated/server.js` missing `internalMutation` for bundling and verified `npx convex dev --once` on `watchful-bat-395.convex.cloud`. Convex features: schema, tables, indexes, queries, mutations, crons, realtime queries (`convex/schema.ts`, `convex/players.ts`, `convex/crons.ts`).

### 2026-08-31 - working tree
Shipped landscape FireRed world and UI: Phaser 4 `OverworldScene.ts` (1600×1200, 480×270 FIT 16:9, pixelArt, generated grass/path/water/house/tree textures + Kenney CC0 `public/assets/characters/roguelike.png` 918×203 and `public/assets/tiles/tiny-town.png`/`tiny-dungeon.png` + `fire-red-open/` pokemon-inspired/tiny16/tuxemon CC BY/SA), authoritative local movement with 70ms throttle, click-to-move and `E` talk, depth-sorted sprites and chat bubbles; `PhaserGame.tsx` robust refs and GBA-ready lifecycle; `src/App.tsx` FireRed landscape (Press Start 2P/VT323, `4px #000` dialogue, START menu, world chat, trainer/online/NPC panels, mobile tabs) and `src/index.css` pixelated scanlines. Fixed rubber-band (local authoritative, 220px teleport only) and NPC race (defer sync to `ready`). Verified `npm run build` and `npx convex dev --once` clean (`src/game/scenes/OverworldScene.ts`, `src/components/PhaserGame.tsx`, `src/App.tsx`, `src/index.css`).
