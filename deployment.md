Backend: https://graceful-buzzard-759.convex.cloud (prod sahil-kumar-f0115:feyman:production)
npx convex deploy --yes pushed functions + indexes (21 indexes)
Env LLM_PROVIDER=gemini, GEMINI_API_KEY, GEMINI_MODEL=gemini-1.5-flash set via npx convex env set --prod
Seeded topics 5 npcs 6 (npx convex run --prod seed:seed → seeded)
Frontend (Convex static hosting): https://graceful-buzzard-759.convex.site (200 HTML)
Installed @convex-dev/static-hosting@0.2.1, wired convex/convex.config.ts:3 import staticHosting + app.use(staticHosting, {httpPrefix:"/"}) (httpPrefix:"/api" for app)
npx convex deploy --yes (component staticHosting installed) + npx @convex-dev/static-hosting upload --prod --build — built VITE_CONVEX_URL=https://graceful-buzzard-759.convex.cloud, uploaded dist 419 files (index-CuAgc2KH.js 1.7MB), atomic publish
curl -I → 200 convex.site
Hackathon log: hackathon.md:6 Live app: https://graceful-buzzard-759.convex.site Frontend: Convex static hosting Components: @convex-dev/static-hosting Last updated: 2026-09-10T18:56:52Z + new 2026-09-10 - working tree deploy entry.
Note: dev remains https://watchful-bat-395.convex.cloud / .site (no hosting).