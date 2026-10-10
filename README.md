# KaamSetu — Your Work. Your Identity. Your Opportunities.

> काम से पहचान, हुनर से अवसर। *(Identity through work, opportunity through skill.)*

KaamSetu is a mobile-first **professional network for skilled, independent and local professionals** — farmers, electricians, carpenters,
mechanics, drivers, tailors, artisans, technicians, farm workers and anyone who earns a living by their skill.
It started as **KisanSetu** (a network and farm operating system for farmers); Phase 2 evolves that same application into a universal
platform **without removing anything the farmer already had**.

Everyone gets one professional profile (skills, services, portfolio, work history, availability, reputation from verifiable facts), can
find and be found, post and apply for work, request services, and join communities — and **Farmer is simply one profession** whose
farm modules (farms, crops, costs/profit, produce listings, Farm Health Score) sit underneath the farmer's profile.

**Everything is fully navigable on seeded demo data. Every demo record is flagged `isDemo` and shows a DEMO badge.**
The architecture (typed REST service layer, Zod contracts, Prisma schema, provider interfaces) is ready to be pointed at a real database
and real providers — see [Going to production](#going-to-production).

## KisanSetu → KaamSetu (Phase 2) in one page

| Area | What changed | What was deliberately kept |
|---|---|---|
| Identity | `User → ProfessionalProfile → Profession`. New role `PROFESSIONAL`. `ProfessionalProfile.userId` is the **same id** as `User.id` and `FarmerProfile.userId`. | Farmer accounts keep role `FARMER`, their `FarmerProfile`, farms, crops, costs, produce, listings, followers, messages. Nothing is deleted or re-keyed. |
| Professions | Catalog of 7 categories (Agriculture, Skilled Trades, Services, Artisan, Technical, Independent, Other) with per-profession skills, services and dynamic profile attributes; admin can add/rename/merge/hide professions and approve "Other" requests. | `Profession.farmModules` is true **only** for Farmer, so farm tabs never appear for an electrician. |
| Profile | One configurable profile UI with sections driven by the profession (no per-profession pages). 8-step *Create Professional Profile* wizard. | `/farmers/[id]` and old profile links redirect to `/professionals/[id]`; the farm tabs ("Farms & crops", "Produce") still show for farmers. |
| Work | Opportunity Center (work, jobs, contracts, training, events, schemes), *Post an opportunity*, applications, hire flow, **My Work** (requests, services, posted, applications). | Existing opportunities (schemes, events, training) stay in the same centre. |
| Services | Service catalog + Service Request flow `PENDING → ACCEPTED/REJECTED/CANCELLED → AWAITING_CONFIRMATION → COMPLETED` (**no payments**). | Marketplace for produce, equipment (machinery) and buyers is unchanged. |
| Discovery | Find Professionals (profession, skill, service, district, distance, experience, availability, verified), reusable `ProfessionalCard`, approximate-location **Work Map**, Businesses. | Global search now covers professionals, farmers, workers, skills, services, businesses, work, posts, reels, communities, events and experts. |
| Content | Profession-aware feed topics, communities by profession/location, government hub (`/schemes`) with topics beyond agriculture, profession-aware learning and AI assistant (Hinglish voice for find/post/create). | All previous schemes, courses, feeds and assistant intents still work. |
| Brand/UI | KaamSetu name, tagline and landing with diverse professionals; adaptive Home dashboard per profession. | The four themes (Farm Light/Dark, Earth, Sunrise) and every Phase-1 farm screen. Farm wording is kept inside farm modules. |

### Migrating an existing KisanSetu deployment

Order matters — **backup → migrate → link → verify → UI**; no data is ever deleted.

1. **Backup:** `pg_dump "$DATABASE_URL" -Fc -f kisansetu-before-phase2.dump`.
2. **Migrate (database):** run `prisma/upgrade/phase2_kaamsetu_professional.sql` (`psql -f` or `prisma db execute --file`). It only *adds* enum values and tables and
   backfills `ProfessionalProfile` from `FarmerProfile`/`ExpertProfile` using the same user id (see the VERIFY queries at the bottom of the script).
3. **Link:** the backfill keeps every existing foreign key pointing to the same person.
4. **Verify:** compare row counts before/after (script includes queries), log in as an existing farmer, open farms/crops/produce.
5. **UI:** deploy the new application build.

For the in-memory demo store, an old persisted store file (`DEMO_STORE_FILE`) is migrated in place on startup (`src/server/migrate.ts`, covered by `tests/migration.test.ts`).
New Phase-2 demo accounts appear only in a *fresh* store.

---

---

## Quick start

```bash
npm install
cp .env.example .env.local        # then set SESSION_SECRET (openssl rand -base64 48)
npm run dev                       # http://localhost:3000
```

Open the landing page and tap **Try a demo account**. All demo accounts use the password `Demo@12345`
and are available only while `DEMO_MODE=true`.

| Demo account | Role | Good for trying |
|---|---|---|
| Ramesh Kumar Choudhary | Farmer | Farms, crops, costs/profit, listing produce, Farm Health Score |
| Sunita Devi Jakhar | Farmer (Hindi UI) | Hindi interface, dairy + wheat |
| Marudhara Oil Mills | Buyer | Requirements, matching, enquiries |
| Dr. Anita Sharma | Expert | Answering questions |
| Demo KVK Churu | Government | Publishing scheme updates (marked DEMO) |
| Shekhawati Kisan Producer Company | FPO | Group listings, members |
| Anil Kumar Prajapat | Professional · Electrician | Services, portfolio, posting/accepting work, business profile |
| Suresh Sharma | Professional · Carpenter | Furniture/door work, applying for jobs |
| Savitri Devi | Professional · Tailor | Service requests from customers |
| Kamla Devi Meghwal | Professional · Farm worker | Seasonal farm-work opportunities |
| Ratan Lal Gurjar | Professional · Mason & contractor | Posting work, hiring, verified business |
| KaamSetu Admin | Admin | Professions & skills, verification, moderation, reports |

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` (TypeScript strict) |
| `npm run lint` | ESLint (Next + TypeScript rules) |
| `npm test` | Vitest — 100 tests (API integration, migration, farmer / electrician / carpenter / farm-worker flows, privacy, units) |
| `npm run db:validate` | Validates the Prisma schema |

To run the production build locally with demo data (staging only) you must opt in explicitly:
`ALLOW_DEMO_IN_PRODUCTION=true OTP_DEV_MODE=false npm run build && npm start`.
The server refuses to start in production with `DEMO_MODE=true` or `OTP_DEV_MODE=true` otherwise.

---

## What's included

**Pages:** `/` (landing; `/landing` redirects), `/login`, `/register`, `/home`, `/explore`, `/reels`, `/create`, `/profile`, `/profile/edit`,
`/farms`, `/farms/[id]`, `/crops`, `/crops/[id]`, `/market`, `/market/[id]`, `/buyers`, `/buyers/[id]`, `/experts`, `/experts/[id]`,
`/communities`, `/communities/[id]`, `/events`, `/events/[id]`, `/live`, `/learning`, `/learning/[id]`, `/schemes`, `/schemes/[id]`, `/health`,
`/machinery`, `/opportunities`, `/professionals`, `/professionals/[id]`, `/profile/create`, `/opportunities/[id]`, `/my-work`, `/businesses`, `/businesses/[id]`, `/map`, `/notifications`, `/messages`, `/ai-assistant`, `/settings`, `/admin`.
Extras: `/farmers`, `/farmers/[id]` (redirects to `/professionals/[id]`), `/orgs/[id]`, `/experts/questions/[id]`, `/saved`, `/live/[id]`, `/offline`.

**Roles:** `PROFESSIONAL`, `FARMER`, `BUYER`, `EXPERT`, `GOVERNMENT`, `FPO`, `ADMIN`. The capability matrix lives in `src/lib/capabilities.ts` and is shared:
the UI hides actions the role can't use, **and every API route re-checks on the server** (`requireCap`, `requireRole`).

**Themes:** four token-driven themes — Farm Light (default), Farm Dark (true dark), Earth, Sunrise — each with Light/Dark/System mode.
Choice persists; an inline script applies it before first paint so there is no flash. All colours are HSL CSS variables (`src/app/globals.css`);
components never hard-code colours.

**Navigation:** bottom bar on mobile (Home · Explore · Create · Opportunities · Profile; Explore holds Professionals, Services, Communities, Events, Experts and Learning, Create holds Post, Reel, Service, Portfolio and Opportunity), sidebar on desktop, global search, floating AI shortcut.

### Privacy & safety by design

- Aadhaar, bank, UPI, passwords, private documents and loan details are **never collected or exposed**. Verification requests only record
  document *labels* ("Land record"), never numbers.
- Income and cost/revenue records are **private by default**; per-field audience controls (`PRIVATE → CONNECTIONS → BUYERS → FPO → PUBLIC`).
  Others only ever see a summary, and only if the owner allows it. Location precision can be limited to district.
- Private fields are stripped in **one place** — the DTO mappers (`src/server/mappers.ts`) and `src/server/privacy.ts` — so a new endpoint can't leak by accident.
- Authorization is server-side. Users cannot assign themselves verification badges: `POST /me/verification` only *requests*; only `/admin/verifications/:id/review` grants.
- A text safety screener blocks OTP/UPI/PIN sharing and scam patterns (HTTP 422 `SENSITIVE_CONTENT`); content with 3+ reports is auto-hidden until an admin reviews it.
- No hard-coded secrets. Env vars + `.env.example`. Nothing secret reaches frontend code (only `NEXT_PUBLIC_*`).
- Sessions are HMAC-signed `HttpOnly` cookies; state-changing requests check `Origin` (CSRF); per-IP rate limits on every route (stricter on auth);
  security headers + CSP are set in `next.config.mjs`.
- **Government hub:** nothing is invented. Demo scheme entries are labelled DEMO and every scheme page links to the official source
  and tells users to verify there. Government accounts publish their own updates.
- **AI is not a doctor.** The assistant and the Health section carry explicit "not a doctor / call 112 or 108" language; emergency routing is rule-based, not generative.
- The **Farm Health Score** measures *record completeness only* and says so; the point breakdown is shown to the user.
- **Professional privacy:** exact home addresses are never shown — only district (or village if the owner allows it) and an approximate map point (district centroid + offset).
  A phone number is released only when the owner's phone audience allows it, and for work only to an *accepted* applicant who was offered phone contact.
  Private professional profiles return a restricted view; every `/professionals/*`, `/services/*`, `/work/*` route checks ownership server-side (no IDOR by changing an id).
- **Reputation is never invented.** The profile shows verifiable counts (jobs confirmed complete by the customer, recommendations tied to a real connection or finished work, years of experience, admin-verified skills).
  There is no star rating field, and only an admin can mark a skill or professional/business as verified.
- No payments are processed. Prices on listings are the farmer's expectation, not a market rate.

---

## Architecture

```
src/
  app/
    (public)/…            landing, login, register
    (app)/…               authenticated pages (wrapped by AppShell; redirects to /login)
    api/[...path]/        single catch-all → typed REST router
    api/uploads, api/files/[key]
  components/
    ui/                   design-system primitives (button, form, card, sheet, tabs, state, …)
    art/                  procedural SVG scenes + own chart components (no chart library)
    layout/               AppShell, nav, auth frame, PWA registration
    features/             screens and domain components
    providers/            theme, i18n, toast, react-query
  hooks/                  useGet / useInfiniteList / useSend / useMe
  lib/                    shared by client and server: zod schemas, capabilities, intents, farm calculations, i18n, geo
  server/
    api/router.ts         pipeline: auth → CSRF → rate-limit → validate (Zod) → controller → ETag
    api/controllers/      auth, profiles, farm, social, market, knowledge, comms, admin
    services/             feed, matching, search, opportunities, AI, messaging, notifications
    db.ts, seed/          in-memory demo store + seeded data
    privacy.ts, mappers.ts, permissions.ts, auth.ts, storage.ts, env.ts
prisma/schema.prisma      PostgreSQL schema mirroring the domain types
tests/                    Vitest: API integration (RBAC, privacy, safety, matching) + unit tests
```

Key decisions:

- **One contract, two ends.** Zod schemas in `src/lib/schemas.ts` validate both the React Hook Form forms and the API; DTO types in `src/types/dto.ts` are what the server returns.
- **Controllers are thin, services are testable.** Business rules (matching, feed ranking, search, opportunities, farm math) are pure functions over the store.
- **Pagination everywhere it matters:** `?cursor=&limit=` → `{ items, nextCursor, total }`.
- **Client data layer:** TanStack Query keyed by request path; invalidation by prefix; optimistic like/save/follow with rollback.
- **Performance:** route-level code splitting, lazy images/video (only the active reel plays), skeleton loaders, ETag on GETs, no chart library, service worker for shell caching (never caches `/api`).
- **Accessibility:** semantic landmarks, focus-trapped sheets, keyboard-operable tabs/chips/players, `aria-live` regions for results and chat, 44px touch targets, visible focus,
  contrast checked with axe-core in all four themes, `prefers-reduced-motion` respected.
- **Voice:** Web Speech API (Hindi/English/Hinglish). Transcripts only fill a text box for review — nothing is auto-submitted.
- **Intent router** (`src/lib/intents.ts`) is shared by voice and the AI assistant: "मेरे पास 50 क्विंटल सरसों है" → prefilled *List produce* form.

---

## Going to production

The demo runs on an in-memory store so the whole product is explorable with zero setup. To go live:

1. **Database.** `prisma/schema.prisma` mirrors `src/types/domain.ts`.
   Set `DATABASE_URL`, run `npx prisma migrate dev`, then replace the in-memory `Db` access in `src/server/db.ts` with a Prisma-backed repository.
   Controllers talk to the store through a small surface (`c.d.*` collections + `persist()`); swap that for repository calls one controller at a time —
   the Vitest integration suite (`tests/api.test.ts`) is the safety net, since it exercises behaviour through HTTP-shaped requests rather than internals.
2. **Disable demo.** `DEMO_MODE=false`, `NEXT_PUBLIC_DEMO_MODE=false`, `OTP_DEV_MODE=false`. An admin can remove all demo records from **Admin → System → Remove demo data**
   (requires a real, non-demo admin account and typing a confirmation phrase).
3. **Auth / OTP.** Password and OTP flows exist. In dev, the OTP is returned in the response (`devCode`); in production set `OTP_PROVIDER` and implement the SMS/email sender
   in `src/server/auth.ts` (the OTP challenge is already HMAC-hashed, rate-limited and attempt-limited). Always set a strong `SESSION_SECRET`.
4. **Object storage.** `StorageProvider` (`src/server/storage.ts`) has a local-disk implementation. Add an S3-compatible provider and set `STORAGE_PROVIDER`.
   Uploads are type- and size-checked; images are compressed client-side first.
5. **AI.** `AIProvider` (`src/server/services/ai.ts`) ships a rule-based provider that works offline. Add an LLM-backed provider
   (`AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`). Keep the intent router, the safety screener and the disclaimers in front of/around it.
6. **Maps.** `MapProvider` (`src/lib/geo.ts`) uses approximate district centroids for "near me" ranking. Implement Google/Mapbox/Bhuvan behind the same interface and set `MAPS_PROVIDER`.
7. **Video / live.** Reels accept a `videoUrl`; the player plays only the visible reel. Live sessions, chat and Q&A work; **no stream is simulated** —
   the UI says "stream not connected". Implement a streaming adapter (LiveKit, Mux, Agora) and set `streamConnected`.
8. **Rate-limit & sessions at scale.** The rate-limit buckets and OTP attempt counters are in-process; move them to Redis when running more than one instance.
9. **Moderation tooling.** Admin console covers verification, reports and content hiding. Add audit logging and appeals before opening to the public.

### Notifications

In-app notifications are created through `notify()` (`src/server/services/notify.ts`), which respects each user's per-category preferences.
Push is architected but not enabled: the service worker (`public/sw.js`) already handles `push` and `notificationclick` events. To enable:
generate VAPID keys (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`), store `PushSubscription`s per user, and enqueue a Web Push (or FCM) job at the marked line in `notify()`.

### Environment variables

See `.env.example` — it documents every variable (session secret, demo flags, OTP, AI, storage, push, maps).

---

## Quality gates

```
npm run typecheck   # TypeScript strict — clean
npm run lint        # ESLint — clean
npm test            # 100 tests — pass
npm run build       # production build — OK
```

Phase-2 QA: the production build was crawled route-by-route (46 pages) as ten demo roles on mobile (390 px) and as five on desktop —
no broken routes, console errors or page-level horizontal scroll — axe-core audited in all four themes on the new pages, and a brand-new
electrician was driven through register → OTP → 8-step wizard → profile → Home in a real browser (no farm wording on their profile or dashboard).
Automated API flows cover a farmer (farms/crops/produce still work), an electrician (profile → skills → service → portfolio → find work → apply), a carpenter (customer request → accept → message, no payment step) and a farm worker (availability → find work → apply), plus ID-tampering/privacy checks, moderation of custom professions and verification that cannot be self-assigned.

For production-mode QA with demo data use `ALLOW_DEMO_IN_PRODUCTION=true OTP_DEV_MODE=false`; registration/OTP flows need `npm run dev` (dev OTP is returned in the response).

## Known limitations (honest list)

- Demo data lives in memory and resets on restart unless `DEMO_STORE_FILE` is set.
- No real video playback for lessons/reels and no live streaming (adapters are defined; none is wired).
- Push notifications, SMS/email OTP delivery, S3 storage and a real LLM are adapters you provide.
- Hindi/Hinglish coverage: the UI shell, assistant intents and voice input are bilingual; long-form content (courses, schemes, health guidance) is English-first.
- Weather/mandi prices are not fetched from live sources; the app never presents invented live data as real.
- **Prisma/PostgreSQL has not been exercised end-to-end.** The schema validates (`npm run db:validate`) and the Phase-2 upgrade SQL was run only against an in-memory Postgres (pglite) with stand-in tables for the Phase-1 schema; run it on a staging copy of your real database first.
- **No real maps.** `/map` is an approximate schematic of district areas with an accessible list; a map provider (`MAPS_PROVIDER`) is not connected.
- **No payments and no money movement.** Service requests and work only record intent and status; wages/prices are expectations.
- **Verification is manual.** Badges (professional, business, skill) are granted only by an admin after review; the demo marks some seeded accounts as verified and labels them DEMO.
- `/professionals` discovery, profiles and the work map require sign-in.
- Government/learning content beyond agriculture is DEMO-labelled sample data with links to official sources; verify on the official site.
