# Architecture CasaMove

## 1. Vue d'ensemble

CasaMove est une application Next.js unique, sans service Python. Les routes de `app/` composent des écrans et exposent l'API. La logique métier vit dans `lib/`, les composants dans `components/`, et Postgres sert à la fois de base métier, de checkpoint LangGraph et de stockage des embeddings.

```text
Navigateur
   │
   ├─ app/(site)        site public et chat
   ├─ app/(auth)        connexion et inscription
   ├─ app/(admin)       console agents
   │
   └─ app/api/*         routes JSON et flux SSE
          │
          ├─ components/*   UI par domaine
          ├─ lib/agent/*    graphe, retrieval, tickets, signaux, VoC
          ├─ lib/auth/*     sessions et comptes
          └─ lib/db.ts      pool et migrations
```

## 2. Couches et dépendances

| Couche | Dossier | Rôle | Ne dépend pas de |
|---|---|---|---|
| Routes | `app/` | Pages, layouts, handlers HTTP | Composants internes d'un autre domaine |
| UI | `components/` | Présentation et interactions | Postgres, LLM |
| Métier | `lib/` | Règles, graphe, accès données | React |
| Contenu | `content/` | Dictionnaires FR/AR/EN et textes du site | `app`, `components`, `lib` |
| Outillage | `scripts/` | Base, seeds, maintenance | UI |
| Recette | `tests/` | Unitaires, API, smoke | Composants React |

Sens autorisé : `app` vers `components` et `lib`, `components` vers `lib` et `content`, `lib` vers `content` et Postgres. Aucun import de `app` depuis `components` ou `lib`.

## 3. Domaines

### Chat et RAG

`components/chat/ChatWidget.tsx` porte l'état de la conversation. Il appelle `POST /api/chat`, qui invoque le graphe LangGraph. Le graphe classe l'intention, route vers la connaissance ou la réclamation, et publie les événements en SSE.

`lib/agent/retrieval.ts` combine un routeur documentaire, une preuve textuelle, un score lexical et des embeddings précalculés. `lib/agent/corpus.ts` reste la source de vérité des 17 fiches.

### Réclamation

`lib/agent/graph.ts` contient le superviseur et les nœuds. Une réclamation passe par `complaint`, puis `hitl` avec `interrupt()`. La console reprend le graphe par `POST /api/tickets/{id}/decision` et `Command({ resume })`. `lib/agent/tickets.ts` gère les statuts, messages, événements et CSAT.

Statuts : `pending`, `in_progress`, `resolved`, `rejected`.

### Console agents

`components/admin/` est découpé par responsabilité :

| Fichier | Rôle |
|---|---|
| `AdminConsole.tsx` | État, effets, appels API, décisions |
| `AdminShell.tsx` | Rail, en-tête, onglets, santé |
| `AdminKpis.tsx` | Quatre indicateurs de file |
| `AdminQueuePanel.tsx` | Filtres, liste, pagination |
| `TicketDetailPanel.tsx` | Fiche dossier, usager, brouillon, journal |
| `SupportChatModal.tsx` | Conversation support en modal |
| `VocPanel.tsx` | Voix du client, période, lignes, CSAT |
| `ProactivityPanel.tsx` | Perturbations, messages libres, relance automatique |

### Proactivité

`lib/agent/signals.ts` crée et diffuse les alertes. `lib/agent/scheduler.ts` lance la relance d'abonnement au démarrage puis toutes les 24 h. Le planificateur est volontairement en processus : il ne dépend d'aucun cron externe et se désactive avec `RENEWAL_AUTO=false`.

### Voix du client

`lib/agent/voc.ts` agrège les dossiers par période, thème, ligne, priorité, statut, sentiment et CSAT. `app/api/voc/route.ts` expose les agrégats, `app/api/voc/export/route.ts` produit le CSV.

## 4. Flux d'une réclamation

```text
Usager
  │ message
  ▼
POST /api/chat
  │
  ▼
Superviseur ──► Knowledge ──► réponse sourcée
  │
  └──────────► Complaint ──► ticket pending + brouillon
                                │
                                ▼
                        Console agents
                                │ publier
                                ▼
                        ticket in_progress
                                │ messages
                                ▼
                        Usager + agent
                                │ accord
                                ▼
                        ticket resolved ──► CSAT 1 à 5
```

## 5. Conventions

- Un fichier de composant exporte un composant nommé, en `PascalCase`.
- Les fonctions de `lib` restent sans état React et testables isolément.
- Les routes API sont minces : validation, garde de session, appel `lib`, réponse JSON.
- Les types partagés sont dans `lib/agent/types.ts`. Les types locaux restent dans leur fichier.
- Le CSS spécifique à un domaine est co-localisé (`components/admin/admin.css`, `components/auth/auth.css`).
- Les textes visibles sont en français. Les commentaires de code sont rares et expliquent une décision, pas une évidence.

## 6. Tests

| Dossier | Portée |
|---|---|
| `tests/unit` | Classification, retrieval, VoC, mots de passe |
| `tests/api` | Auth, chat, support, cycle de réclamation, admin |
| `tests/smoke` | Routeur et retrieval avec l'API NVIDIA réelle |

Les tests locaux utilisent `casamove_test`, `LLM_ENABLED=false`, `EMBEDDINGS_ENABLED=false` et `RENEWAL_AUTO=false`.

## 7. Décisions structurantes

1. Un seul runtime TypeScript, pas de service Python.
2. Postgres unique pour métier, checkpoints et embeddings.
3. RAG sur 17 fiches, sans base vectorielle dédiée.
4. HITL durable par `interrupt()` et reprise sur le même `thread_id`.
5. Relance d'abonnement automatique en processus, sans cron externe.

## 8. Déploiement

`Dockerfile` produit une image Next.js standalone, non-root, avec healthcheck. `compose.yaml` ajoute Postgres 18 et un service de seed idempotent. Les migrations tournent au premier appel de `/api/health`. Les détails sont dans `docs/docker.md`.

