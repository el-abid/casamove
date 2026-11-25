# Fiches agents CasaMove

Cinq fiches PDF expliquent les cinq agents du projet. Chaque fiche suit le même plan : rôle, fichiers, trajet d'une demande, code expliqué étape par étape, exemple réel, garde-fous et checklist de présentation.

| # | Agent | PDF | Pages | Fichiers principaux |
|---|---|---|---|---|
| 01 | Superviseur | `Agent_01_Superviseur_CasaMove.pdf` | 8 | `graph.ts`, `classification.ts` |
| 02 | Support | `Agent_02_Support_CasaMove.pdf` | 9 | `support.ts`, `tickets.ts` |
| 03 | Knowledge | `Agent_03_Knowledge_CasaMove.pdf` | 8 | `retrieval.ts`, `corpus.ts` |
| 04 | Réclamation | `Agent_04_Reclamation_CasaMove.pdf` | 11 | `graph.ts`, `tickets.ts` |
| 05 | Succès client | `Agent_05_Succes_Client_CasaMove.pdf` | 10 | `signals.ts`, `scheduler.ts` |

## Répartition pour 4 personnes

Une proposition pour couvrir 5 fiches à 4 :

| Personne | Fiches | Pourquoi ce regroupement |
|---|---|---|
| 1 | Superviseur + Support | Les deux lisent l'état et les outils, la transition est naturelle |
| 2 | Knowledge | Fiche autonome sur le RAG et les preuves |
| 3 | Réclamation | Fiche la plus longue, centrée sur le HITL et les statuts |
| 4 | Succès client | Fiche autonome sur les signaux et le planificateur |

## Regénérer les PDF

Les PDF sont générés depuis les fichiers Markdown du même dossier.

```bash
cd docs
npm install
npm run build:agents
```

Le script `build-agent-pdfs.mjs` utilise PDFKit. Il produit une couverture, une carte d'identité, un sommaire, les sections, les blocs de code, les tableaux et les encadrés.

## Note de périmètre

La Voix du client n'est pas un agent. C'est le tableau de bord d'analyse qui agrège les dossiers, les thèmes, les lignes, le sentiment et le CSAT. Les cinq agents présentés sont ceux qui produisent ou traitent les demandes et les signaux.
