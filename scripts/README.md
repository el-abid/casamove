# Scripts

| Script | Commande | Rôle |
|---|---|---|
| `db.ps1` | `npm run db:*` | Initialise, démarre, arrête ou vérifie Postgres sur le port 5544 |
| `seed.ps1` + `seed.sql` | `npm run db:seed` | Charge le jeu de démonstration |
| `seed-subscriptions.mjs` | `npm run db:seed:subs` | Crée les abonnements de démonstration |
| `seed-tickets.ts` | `npm run db:seed:tickets` | Charge les 24 dossiers VoC depuis `seed.sql` |
| `create-admin.mjs` | `npm run db:admin` | Crée un compte administrateur |
| `build-embeddings.mjs` | `npm run embeddings:build` | Recalcule les vecteurs des 17 fiches |
| `import-alsa.mjs` | `node scripts/import-alsa.mjs` | Importe les 57 lignes Casabus depuis l'API publique |
| `reclassify-tickets.ts` | `npm run tickets:reclassify` | Reclasse thème, priorité, sentiment et SLA |
| `backfill-lines.ts` | `npm run tickets:lines` | Extrait la ligne des dossiers existants |

Les scripts de maintenance supposent `CASAMOVE_DATABASE_URL` défini ou le fichier `.env.local` présent.
