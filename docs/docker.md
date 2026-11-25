# Docker CasaMove

## 1. Services

| Service | Image | Rôle |
|---|---|---|
| `db` | `postgres:18-alpine` | Base métier, checkpoints et données |
| `app` | `casamove-app` | Next.js standalone sur le port 3000 |
| `seed` | `casamove-seed` | Charge les dossiers, comptes et abonnements de démonstration |

`compose.yaml` déclare un volume nommé `postgres_data` monté sur `/var/lib/postgresql`. PostgreSQL 18 utilise un répertoire versionné (`/var/lib/postgresql/18/docker`) et le volume doit cibler le parent. Un montage sur `/var/lib/postgresql/data` ne persiste pas correctement.

## 2. Image applicative

`Dockerfile` contient quatre étapes :

1. `base` : Node 24 Bookworm slim, télémétrie Next désactivée.
2. `deps` : `npm ci` avec cache npm.
3. `builder` : `npm run build`, sortie `standalone`.
4. `runner` : serveur seul, utilisateur non-root `nextjs`, healthcheck intégré.

Le runtime copie `.next/standalone`, `.next/static` et `lib/agent/embeddings.json`. Les 51 vecteurs sont donc disponibles même si le tracing de Next oublie le fichier JSON.

Une étape `tools` existe pour le seed. Elle embarque `node_modules`, `scripts/` et `lib/db.ts`, sans le build Next.

## 3. Démarrage

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker run --rm seed
```

Sans fichier d'environnement, les valeurs par défaut fonctionnent pour une démonstration locale :

```bash
docker compose up -d --build
docker compose run --rm seed
```

Le seed est idempotent :

- 24 dossiers VoC, 20 clôturés et 4 rejetés
- CSAT 4 ou 5 sur les dossiers clôturés
- trois comptes usagers
- un compte admin

## 4. Variables

| Variable | Défaut | Usage |
|---|---|---|
| `APP_PORT` | `3000` | Port publié par Compose |
| `CASAMOVE_DB_NAME` | `casamove` | Nom de la base |
| `CASAMOVE_DB_USER` | `casamove` | Utilisateur Postgres |
| `CASAMOVE_DB_PASSWORD` | `casamove` | Mot de passe Postgres |
| `NVIDIA_API_KEY` | vide | Active le LLM et les embeddings |
| `NVIDIA_MODEL` | `nvidia/nemotron-3.5-bolt-e4b` | Modèle de génération |
| `NVIDIA_EMBED_MODEL` | `nvidia/nemotron-3.5-embed-1b` | Modèle d'embedding |
| `LLM_ENABLED` | `true` | Coupe le LLM sans redéployer |
| `EMBEDDINGS_ENABLED` | `true` | Coupe le retrieval dense |
| `RENEWAL_AUTO` | `true` | Relance automatique des abonnements |
| `COOKIE_SECURE` | `false` | À passer à `true` derrière HTTPS |

Les variables `POSTGRES_*` du poste ne sont pas utilisées. Le projet utilise `CASAMOVE_DB_*` pour éviter les collisions avec un Postgres local.

Le mot de passe est inséré dans `DATABASE_URL`. Il doit être compatible URL, ou être encodé avant d'être placé dans l'URL.

## 5. Exploitation

```bash
docker compose ps
docker compose logs -f app
docker compose exec db psql -U casamove -d casamove
docker compose down
docker compose down -v
```

`down` conserve le volume. `down -v` supprime la base.

Sauvegarde :

```bash
docker compose exec db pg_dump -U casamove -d casamove > casamove.sql
```

Restauration :

```bash
docker compose exec -T db psql -U casamove -d casamove < casamove.sql
```

## 6. Santé et vérifications

`GET /api/health` est public, exécute les migrations et vérifie `SELECT 1`. Il renvoie `200` avec `{"status":"ok"}` ou `503` avec `{"status":"degraded"}`. C'est l'endpoint du healthcheck Docker.

Vérifications effectuées le 25 novembre 2026 :

| Contrôle | Résultat |
|---|---|
| Build des deux images | OK |
| `db` et `app` healthy | OK |
| Seed 24 dossiers | OK |
| Console admin | 24 dossiers, VoC 4.4/5, lignes 6/6/6/6 |
| Chat RAG | Réponse tarifs sourcée sur la fiche `fares` |
| Relance automatique | 1 signal après redémarrage |
| Embeddings | 51 vecteurs chargés |

## 7. Production

1. Changer `CASAMOVE_DB_PASSWORD` et utiliser un secret Docker ou un gestionnaire de secrets.
2. Passer `COOKIE_SECURE=true` derrière un reverse proxy HTTPS.
3. Ne pas publier le port Postgres.
4. Sauvegarder le volume `postgres_data`.
5. Limiter les ressources et configurer les logs Docker.
6. Mettre à jour les images Node et Postgres avec un cycle de patch.

## 8. Dépannage

| Symptôme | Cause probable | Geste |
|---|---|---|
| `port is already allocated` | Un serveur local écoute sur 3000 | Arrêter `npm run start` ou changer `APP_PORT` |
| `password authentication failed` | Volume créé avec d'autres identifiants | `docker compose down -v`, puis relancer |
| `Invalid URL` au démarrage | Mot de passe non encodé dans `DATABASE_URL` | Utiliser un mot de passe URL-safe |
| Health `503` | Postgres pas prêt ou schéma en erreur | Vérifier `docker compose logs db` |
| Pas de réponse LLM | `NVIDIA_API_KEY` absente | Le lexical prend le relais, ou renseigner la clé |
