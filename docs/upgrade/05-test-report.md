# Verification report

26 November 2026 · Windows host and Linux Docker Desktop containers.

## Automated regression

| Run | Result |
| --- | --- |
| Existing baseline TypeScript | Passed |
| Existing baseline Vitest suite | 108 passed across 12 files |
| Upgraded production build and TypeScript | Passed on Windows and in Docker |
| Upgraded Vitest suite | 121 passed across 14 files |
| Fresh isolated Compose seed | 24 complaint records, three passenger demo accounts and one admin created |

The tests used an isolated PostgreSQL 18 container at port 5544 with NVIDIA inference, embeddings and scheduled renewals disabled. The 13 new tests cover network integrity and bilingual search, deterministic alternatives, direction, preferences, closures, restrictions, import idempotence, admin revision checks, report deduplication, ownership and notification reads. Live NVIDIA smoke tests were not run.

An initial Windows build inside the sandbox could not create a Turbopack junction. The build succeeded with junction access on the same checkout. An initial isolated Compose invocation lacked `docker-credential-desktop` on PATH. Adding Docker Desktop's bin directory to the current process fixed the build.

## Routing benchmark

Node 24.22.3 on the Windows host, 1,000 sequential route calls after 150 warm-ups, cycling between Casa Port → Sidi Maarouf, Ouled Azzouz → Mohammed Erradi and Sidi Moumen → Lissasfa. Up to three alternatives per call. The measured median was 3.990 ms, p95 9.167 ms, and maximum 63.610 ms. This measures graph computation without database or network round trips.

## Browser verification

The Playwright run completed against the isolated Compose app at port 3211 with Chrome, three independent browser contexts, a 1440 × 960 desktop viewport and a 390 × 844 mobile viewport. It recorded zero unhandled page errors.

- French and English homepages, Arabic RTL mobile navigation, keyboard skip link, station suggestions in French and Arabic, and mobile width checks passed.
- The passenger planned and saved Casa Port → Sidi Maarouf, started and paused Travel Companion, then resumed it after reload. The simulated segment closure triggered a valid alternate route in **4,840 ms** from the admin action without a page load. The unrelated journey kept its route. BW1 suspension produced a no-alternative state, and resolution restored connectivity.
- A passenger submitted a segment report. An administrator confirmed it and linked it to the simulation. The passenger saw their saved trip, demo wallet, report and resolution notifications, then marked notifications read.
- The schematic rendered all 151 stations. The geographic view rendered 143 attributed station markers and loaded 18 background tiles during the run.
- The manifest and service worker loaded in production mode. The public cache contained 31 entries and excluded private and current-status endpoints. The schematic and route planner worked offline, displayed a stale status and recovered after reconnecting.
- Chrome's installability diagnostic returned zero errors in a temporary non-incognito profile on the upgraded original stack.

## Original Compose stack

`docker compose up -d --build` rebuilt and recreated the application. `docker compose ps` subsequently reported both the app and PostgreSQL healthy. App logs showed Next.js 16.4.6 ready on port 3000. The database container identity and `casamove_postgres_data` mount were the same before and after the update.

The database had 4 users, 24 complaints, 3 subscriptions and 0 sessions both before and after the update. The additive mobility import created 151 station registry records and one network-version snapshot, with no demonstration incidents in the original stack. The isolated Compose importer returned the same counts in two consecutive runs.

The original stack returned HTTP 200 for `/api/health`, public mobility network and status endpoints, the three passenger homepages, planner, network, traffic, reports, login, manifest and service worker. Unauthenticated account and admin routes redirected with HTTP 307. The running app had no NVIDIA API key.

## Screenshots

The 15 browser captures are in [screenshots](screenshots/). They cover the [French homepage](screenshots/01-accueil-fr.png), [planned trip](screenshots/02-itineraire-multimodal.png), [companion](screenshots/03-compagnon.png), [rerouting](screenshots/04-reroutage.png), [Control Tower](screenshots/05-control-tower.png), [no alternative](screenshots/06-sans-alternative.png), [Community Pulse](screenshots/07-community-pulse.png), [moderation](screenshots/08-moderation.png), [account and wallet](screenshots/09-espace-et-wallet.png), [notifications](screenshots/10-notifications.png), [schematic](screenshots/11-reseau-schematique.png), [geographic map](screenshots/12-carte-geographique.png), [Arabic mobile](screenshots/13-mobile-ar.png), [English homepage](screenshots/14-accueil-en.png) and [offline routing](screenshots/15-planificateur-hors-ligne.png).

## Reproduce browser verification

Use an isolated Compose project and the existing demo seed. The Playwright script creates temporary simulation records and a demo report in that project.

```powershell
$env:APP_PORT = "3211"
$env:LLM_ENABLED = "false"
$env:EMBEDDINGS_ENABLED = "false"
$env:RENEWAL_AUTO = "false"
docker compose -p casamove-upgrade-qa up -d --build
docker compose -p casamove-upgrade-qa run --rm --build seed
node tests/browser/mobility.mjs
```

The browser script needs Playwright. Set `CASAMOVE_PLAYWRIGHT_MODULE` to the absolute path of Playwright's `index.mjs` when installed outside the repo. It can use Playwright's managed Chromium or an installed Chrome path via `CASAMOVE_BROWSER_EXECUTABLE`. The default URL is `http://localhost:3211` and screenshots are written to `docs/upgrade/screenshots`.
