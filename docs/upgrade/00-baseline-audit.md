# CasaMove baseline audit

26 November 2026 · `sophia/platform-upgrade` · baseline commit `44d7649` · clean working tree on arrival.

## Application and integration points

- Next.js App Router serves the French, Arabic and English passenger portal, account and authentication screens, and the protected agent console. `content/dictionary.ts` provides translations and document direction. The shared layout mounts the existing chat widget.
- The agent console handles complaints, Voice of Customer and existing proactive signals. The account reads the current passenger's complaints and subscription using the existing session. The homepage mainly presents information and promotional sections. The repo had no station graph, standalone directions or shared mobility incident state.
- PostgreSQL uses the existing `lib/db.ts` pool and startup migration. The running database contains `users`, `sessions`, `subscriptions`, `tickets`, `ticket_messages`, `ticket_events`, `ticket_decisions`, `signals` and `signal_deliveries`. Docker Compose runs the app and PostgreSQL separately and uses the named `casamove_postgres_data` volume.
- The new mobility namespace can reuse authenticated user IDs, the database pool, localisation and the existing visual components. Mobility updates need a distinct source and effect model because the existing signal API delivers messages and has no routing semantics. Existing server-side session ownership remains the access boundary.
- The existing console has two roles and the backend has no global rate limiter. The current health endpoint confirms database connectivity. It does not itself prove that external NVIDIA inference or embeddings are available.

## Checks before implementation

- Running containers `casamove-app-1` and `casamove-db-1` were healthy. `/api/health` returned 200, as did `/fr`, `/ar`, `/en` and `/login`. An unauthenticated `/admin` redirected with 307.
- After installing the locked dependencies, TypeScript passed and all 108 baseline tests passed across 12 files with NVIDIA inference and embeddings disabled. The first Windows sandbox build could not create a Turbopack junction. The same build succeeded outside the sandbox.
- The existing Vitest setup resets the `casamove_test` database at port 5544. Test runs use a separate disposable PostgreSQL instance on that port and never point the reset code at Compose's application database.

## CasaConnect AI reference

The supplied GitHub repository was accessible read-only. Its `main` tree only exposed a README, so the local `CasaConnect_AI_Presentation` and its evidence notes supplied the useful comparison. CasaConnect's passenger journey from self-service to durable complaint history, evidence labelling, and clear operational metrics apply to this upgrade. CasaMove already has the equivalent human review and complaint history, so the mobility feature adds independent routing and operational incident handling around those interfaces.
