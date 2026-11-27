# CasaMove

Application Next.js 16 unique, sans service Python : site public FR/AR/EN, chat RAG, console agents et réclamations avec validation humaine. Postgres 18 sert de base métier, de checkpointer LangGraph et de stockage des embeddings. Interface et docs en français, identifiants de code en anglais.

## Commandes

- `npm run dev` : port 3000, `/` redirige vers `/fr`.
- `npm run typecheck`, `npm run format:check`. Pas d'ESLint : `typescript-eslint` ne supporte pas TypeScript 7.
- `npm run test` : build Next puis Vitest. Le build est obligatoire : `tests/setup/global.ts` vérifie `.next/BUILD_ID`.
- `npm run test:unit` et `test:api` ne buildent pas : lancer `npm run build` d'abord si `.next` est absent.
- Les suites unit et api passent par le setup global : serveur Next dédié sur **3210** et base `casamove_test` recréée. Un serveur déjà sur 3210 fait échouer le setup.
- `npm run test:smoke` appelle NVIDIA et se saute automatiquement sans `NVIDIA_API_KEY`.

## Base de données

- Cluster PG18 local dans `.pgdata`, port 5544, piloté par `scripts/db.ps1`. Les binaires sont codés en dur (`C:\Program Files\PostgreSQL\18\bin`) : scripts Windows uniquement.
- L'application ne lit que `CASAMOVE_DATABASE_URL` (`lib/db.ts`). `DATABASE_URL` est volontairement ignorée : sur ce poste cette variable globale appartient au projet dental_saas. Les scripts résolvent l'URL via `scripts/db-url.mjs`.
- Bases : `casamove_dev` par défaut, `casamove_test` pour les tests.
- Le cluster doit tourner (`npm run db:start`) avant seeds et tests, sinon la connexion au port 5544 échoue.
- Piège : `npm run db:init` crée la base `casamove`, pas `casamove_dev`. Créer `casamove_dev` ou pointer `CASAMOVE_DATABASE_URL` sur `casamove`.
- Migrations paresseuses : `ensureDb()` exécute le schéma au premier accès DB, déclenché par `/api/health`. Sans ce premier appel, `npm run db:seed` échoue sur `relation "tickets" does not exist`.
- Seeds : `db:seed` (24 dossiers VoC), `db:seed:subs` (3 usagers + abonnements), `db:admin -- email motdepasse "Nom" 0600000000`.
- `README.md` et `scripts/README.md` mentionnent encore `DATABASE_URL` : le code fait foi.

## Architecture

- Écrans : `app/(site)/[locale]`, `app/(auth)`, `app/(admin)`. Tout le JSON et le SSE sous `app/api/*`.
- `components/` ne parle jamais à Postgres, `lib/` porte la logique métier sans React, `content/dictionary.ts` et `content/site.ts` ne dépendent d'aucun autre dossier.
- `lib/db.ts` : pool et migrations. `lib/agent/graph.ts` : graphe LangGraph (superviseur, knowledge, complaint, HITL). `lib/agent/corpus.ts` : source de vérité des fiches RAG.
- Réclamation : `interrupt()` suspend le graphe, `POST /api/tickets/[id]/decision` reprend avec `Command({ resume })` sur le même `thread_id`.
- Pas de base vectorielle : embeddings précalculés dans `lib/agent/embeddings.json`, inclus dans le build standalone via `next.config.mjs`.
- `docs/` est un projet npm séparé (génération PDF, dépendances propres) exclu de `tsconfig`. Ne pas y ajouter de code applicatif.

## Conventions

- Server Components par défaut ; `"use client"` réservé aux écrans interactifs.
- Types partagés dans `lib/agent/types.ts`, pas de `any`.
- Composants en PascalCase, fonctions et variables en camelCase, CSS co-localisé par domaine.
- Next.js 16 diffère des versions connues : lire `node_modules/next/dist/docs/` avant d'écrire une route ou une page.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
