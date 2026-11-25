# CasaMove

Service client pour le réseau de transport CasaMove. Le projet couvre le chat usager, le RAG documentaire, la console agents, la voix du client, la proactivité et le cycle complet de réclamation.

## Stack

- Next.js 16, React 19, TypeScript 7
- LangGraph.js 1.7 pour le graphe d'agents et les checkpoints Postgres
- PostgreSQL 18, sans base vectorielle séparée
- NVIDIA NIM pour le modèle et les embeddings

## Démarrage

```bash
npm install
npm run db:init
npm run db:seed
npm run db:seed:subs
npm run dev
```

Copier `.env.example` vers `.env.local` et renseigner `NVIDIA_API_KEY` pour activer le LLM et les embeddings. Sans clé, le système bascule sur le corpus lexical.

Le premier `npm run db:init` crée le cluster local dans `.pgdata` sur le port 5544. Pour créer un administrateur :

```bash
npm run db:admin -- admin@exemple.ma MotDePasse2026! "Nom Admin" 0600000000
```

| URL | Usage |
|---|---|
| `http://localhost:3000/fr` | Site et chat usager |
| `http://localhost:3000/admin` | Console agents |
| `http://localhost:3000/login` | Connexion |

Comptes de démonstration :

| Compte | Mot de passe | Rôle |
|---|---|---|
| `admin@casamove.ma` | `CasaMove2026!` | Admin |
| `usager@casamove.ma` | `Usager2026!` | Usager avec abonnement proche de l'échéance |
| `mensuel@casamove.ma` | `Mensuel2026!` | Usager sans relance |
| `expire@casamove.ma` | `Expire2026!` | Usager expiré |

## Docker

L'image est multi-étapes : dépendances, build Next.js standalone, runtime non-root. Postgres 18, l'application et le seed sont décrits dans `compose.yaml`.

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker run --rm seed
```

Sans fichier d'environnement, les valeurs de démonstration suffisent :

```bash
docker compose up -d --build
docker compose run --rm seed
```

Le seed charge 24 dossiers VoC, les trois comptes usagers et l'admin. Il est idempotent.

| Commande | Effet |
|---|---|
| `npm run docker:up` | Démarre Postgres et l'application |
| `npm run docker:seed` | Charge le jeu de démonstration |
| `npm run docker:logs` | Suit les logs de l'application |
| `npm run docker:down` | Arrête les conteneurs, conserve les données |

L'application écoute sur `http://localhost:3000`. Les migrations tournent au premier appel de `/api/health`. Pour vider aussi la base :

```bash
docker compose down -v
```

Détails, variables et dépannage : `docs/docker.md`.


## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run format` | Formatage Prettier |
| `npm run format:check` | Vérifie le formatage sans écrire |
| `npm run test` | Build puis 108 tests Vitest |
| `npm run test:unit` | Tests unitaires |
| `npm run test:api` | Tests API sur `casamove_test` |
| `npm run test:smoke` | Retrieval et routeur avec l'API réelle |
| `npm run db:start` / `db:stop` / `db:status` | Cycle de vie Postgres local |
| `npm run db:seed` | Jeu de démonstration |
| `npm run db:seed:subs` | Abonnements de démonstration |
| `npm run db:admin` | Création d'un compte admin |
| `npm run embeddings:build` | Recalcule les 51 vecteurs |
| `npm run tickets:reclassify` | Reclasse l'historique des dossiers |
| `npm run tickets:lines` | Rattache les anciens dossiers à une ligne |
| `npm run docker:up` / `docker:down` | Démarre ou arrête la stack Docker |
| `npm run docker:seed` | Charge le jeu de démonstration Docker |

## Organisation

```text
app/                 Routes Next.js, pages et API
components/
  admin/             Console, file, fiche dossier, chat support, CSS
  auth/              Connexion et inscription
  chat/              Widget usager, messages, lanceur
  site/              En-tête, héros, actualités, pied de page
  ui/                Composants transverses
lib/
  agent/             Graphe, retrieval, tickets, signaux, VoC, abonnements
  auth/              Sessions, mots de passe, comptes
  db.ts              Pool, migrations et schéma
  health.ts          Santé DB, LLM et embeddings
content/             Dictionnaires FR/AR/EN et textes du site
scripts/             Base locale, seeds et maintenance
tests/               unit, api, smoke, helpers et setup
docs/                Cahier des charges, note, scénario, PDF
```

Règles de dépendance :

1. `app` ne contient que des routes et des compositions de pages.
2. `components` ne parle jamais directement à Postgres.
3. `lib` porte la logique métier et les accès aux données.
4. `content` ne dépend d'aucun autre dossier applicatif.
5. Les tests appellent l'API ou les fonctions de `lib`, jamais les composants.

Voir `docs/architecture.md` pour les flux et les conventions détaillées.

## Conventions

- Interface, messages et documentation en français. Identifiants de code en anglais.
- Composants en `PascalCase`, fonctions et variables en `camelCase`.
- Server Components par défaut, `"use client"` réservé aux écrans interactifs.
- Types partagés dans `lib/agent/types.ts`, pas de `any`.
- CSS co-localisé avec son domaine quand il est spécifique (`admin.css`, `auth.css`).
- Une route API valide ses entrées, vérifie la session et renvoie du JSON.

## Qualité

`npm run typecheck` vérifie TypeScript, `npm run format:check` vérifie le style, `npm run test` construit l'application puis exécute les 108 tests. ESLint n'est pas branché : `typescript-eslint` 8.74 ne supporte pas encore TypeScript 7.0.

## Limites assumées

- Pas de rôle agent séparé de l'admin.
- Pas de rate limiting global.
- Notifications limitées au chat et à la console.
- Relance d'abonnement automatique en processus, sans ordonnanceur externe.
- Pas de déploiement, de sauvegarde ni de supervision externe.
