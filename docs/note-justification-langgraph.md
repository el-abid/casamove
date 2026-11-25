## Verdict

**La plateforme Agentic d'ABA ne peut pas porter seule les exigences du cahier des charges. LangGraph.js doit tenir l'orchestration, l'état des dossiers et la validation humaine. La plateforme garde trois rôles utiles : itération des prompts, flow de connaissance, instance de démonstration.**

Ce verdict ne repose pas sur une préférence technique. Il découle de quatre exigences structurantes du cahier, F5, F6, F7 et NF5, qu'aucun builder visuel ne couvre nativement aujourd'hui.

## 1. Objet de la note

Le cahier des charges fixe huit exigences fonctionnelles et six exigences non fonctionnelles pour la V1 du service client CasaMove. Deux options d'implémentation ont été envisagées : tout construire sur la plateforme Agentic d'ABA, ou tout construire en code avec LangGraph, version Python puis portage JavaScript. Ce document compare les deux, tranche, et précise les conditions dans lesquelles l'arbitrage devrait être revu.

## 2. Ce que la plateforme ABA apporte réellement

L'interface de staging observée le 17 novembre 2026 est un builder visuel de flows. Elle expose des projets, des workflows, des outils, un store de templates, des serveurs MCP, des clés d'API et des variables globales. Un flow peut être appelé comme outil par un agent, et exposé comme API.

Ses forces sont réelles et mesurables.

1. **Vitesse de prototypage.** Un flow de connaissance se monte en quelques heures, sans écrire de code d'infrastructure.
2. **Lecture métier.** Un responsable qualité comprend un canvas plus vite qu'un fichier Python.
3. **Itération de prompt.** Le test dans le canvas raccourcit la boucle de réglage.
4. **Composants prêts.** Retrieval, modèles, connecteurs et outils sont fournis.
5. **Démonstration.** L'instance de staging sert de vitrine sans travail de déploiement.

L'interface présente les marqueurs d'un builder dérivé de Langflow : routes `/flows`, `/projects`, `/store`, `/settings/mcp-servers`, mode tool, expositions MCP. La conclusion pratique est simple : les primitives et les limites de Langflow s'appliquent, sous réserve de confirmation par l'éditeur. Un builder visuel orchestre des appels. Il ne fournit pas, par défaut, un moteur d'état durable avec reprise, ni une horloge métier.

## 3. Les quatre exigences qui disqualifient la plateforme seule

| Exigence | Ce qu'il faut | Ce qu'offre la plateforme | Écart |
|---|---|---|---|
| F5, validation humaine | Suspendre un dossier, attendre des heures, reprendre au même nœud | Aucune interruption durable native | Le HITL devient un contournement applicatif |
| F4 et NF5, SLA et audit | Échéances, relances, journal en ajout seul, rejeu | Pas d'ordonnanceur, journal limité | Deux services externes à écrire |
| F6, proactivité | Déclencher une alerte sans message entrant | Pas de planification | Un cron et une file à ajouter |
| F7, console agents | File triée par échéance, décision signée | Pas d'écran métier | Console à développer entièrement |

Une nuance importante : la plateforme peut appeler une API qui fait ces choses. Mais alors le cœur du système vit ailleurs, et la plateforme devient un habillage. Autant l'assumer et mettre le cœur dans un endroit testable.

## 4. Comparaison critère par critère

| Critère | LangGraph.js | Plateforme ABA seule |
|---|---|---|
| État partagé entre agents | Typé, versionné, checkpointé | Passage de messages, pas d'état métier |
| Suspension et reprise | `interrupt()` et `Command(resume=...)` | Contournement par API |
| Délais et relances | Minuteries en processus, testables et mesurables | Aucun ordonnanceur |
| Journal et rejeu | Trace par nœud, rejeu en lecture | Journal d'exécution limité |
| Tests automatisés | Tests Node sur le graphe et les nœuds | Tests de flow, peu outillés |
| Versionnement | Git, revue de code | Export JSON, revue difficile |
| Dépendance éditeur | Aucune, open source | Staging non public |
| Licence | MIT pour LangGraph.js | Non documentée pour le fork |
| UI et démo | À construire | Prête |
| Compétence requise | TypeScript, asynchrone | Configuration visuelle |

## 5. Matrice de décision pondérée

Notation de 1 à 5, pondération sur 100. Les poids traduisent le cahier des charges, pas une opinion : la couverture des exigences Must pèse le plus lourd.

| Critère | Poids | LangGraph.js | Plateforme | Hybride |
|---|---|---|---|---|
| Couverture des Must | 30 | 5 | 3 | 5 |
| État durable et HITL | 20 | 5 | 1 | 5 |
| Audit et tests | 15 | 5 | 2 | 5 |
| Délai de mise en œuvre | 15 | 2 | 5 | 3 |
| Indépendance, lock-in | 10 | 5 | 1 | 3 |
| UX et démonstration | 10 | 2 | 5 | 5 |
| **Score pondéré** | **100** | **4,25** | **2,75** | **4,50** |

Test de sensibilité : si le délai devient le critère dominant, avec un poids de 30, la plateforme monte à 3,15, LangGraph.js à 3,80 et l'hybride à 4,20. Le classement ne change pas.

Lecture : l'hybride gagne parce qu'il combine le moteur d'état avec les composants visuels. LangGraph.js seul perd sur le délai et la démo. La plateforme seule perd sur tout ce qui produit de la valeur métier durable.

Écart constaté après mise en œuvre : le portage JavaScript a supprimé l'installation Python et le second processus. Le moteur a été livré en deux jours, pas en trois semaines. Le tableau ci-dessus reste l'estimation faite avant le choix de LangGraph.js.

## 6. Coût et délai

| Option | Délai V1 | Travail caché | Dette |
|---|---|---|---|
| Plateforme seule | 2 semaines | 4 contournements, environ 5 jours | Élevée, non testable |
| LangGraph seul | 3 semaines | Aucun | Faible |
| Hybride | 3 semaines et 2 jours | Intégration du flow ABA | Faible |

Le différentiel de deux semaines entre la plateforme seule et LangGraph est réel. Il disparaît dès qu'on compte le HITL, la file SLA et le journal, qui doivent être écrits dans les deux cas. La plateforme ne fait gagner que sur l'écran de chat et le retrieval, soit environ trois jours.

## 7. Risques de LangGraph seul, et parades

1. **Compétence.** TypeScript asynchrone, streaming, graphes. Parade : périmètre réduit, deux agents au jalon 3, pas de fonctionnalité hors cahier.
2. **Délai.** L'estimation initiale était de trois semaines. Le portage JavaScript et le périmètre réduit ont ramené le moteur à deux jours. Parade : la page d'accueil reste statique, la console est minimale à J6.
3. **Pas d'UI.** Parade : Next.js et quatre composants suffisent, le design n'est pas le sujet.
4. **Exploitation.** Parade : un seul processus Next.js, Postgres local, scripts `db:start` et `db:stop`.
5. **Coût des appels.** Parade : réponses courtes, deux appels par message, repli déterministe si le modèle échoue.

## 8. Risques de la plateforme seule, et parades

1. **Continuité.** Le staging n'est pas un service public. Parade : export des flows, corpus versionné, prompts dans le dépôt.
2. **Licence.** Le fork ABA n'a pas de licence publique documentée. Parade : demander une confirmation écrite avant tout usage en production.
3. **Verrouillage.** Un flow exporté en JSON reste lisible, mais l'exécution dépend de la plateforme. Parade : ne jamais y mettre l'état des dossiers.
4. **Débogage.** Un canvas de vingt nœuds devient difficile à relire et à tester. Parade : limiter la plateforme aux flows de connaissance et de démonstration.
5. **Conformité.** Les données de staging ne sont pas couvertes par un accord de traitement. Parade : aucune donnée personnelle réelle.

## 9. Décision recommandée

L'architecture retenue est l'hybride, avec une frontière nette.

| Couche | Responsable | Contenu |
|---|---|---|
| Orchestration | LangGraph.js | Superviseur, état, routage, HITL, reprise |
| Connaissance | Corpus local en V1, plateforme ABA en V2 | Routeur documentaire, retrieval hybride de secours |
| Expérience | Next.js 16 | Page publique, chat, console agents |
| Données | Postgres 18 | Tickets, checkpoints |

Trois règles gouvernent cette frontière.

1. Aucun état de dossier dans la plateforme. Si le staging s'arrête, la démo continue en local.
2. Tout prompt validé est recopié dans le dépôt, avec sa version.
3. La plateforme est appelée comme un outil, jamais comme le point d'entrée unique.

En V1, la plateforme n'est pas branchée. Le corpus local assure la démonstration, et le flow ABA reste une cible V2.

## 10. Critères de bascule

L'arbitrage change dans trois cas, à documenter explicitement.

1. **Deadline sous trois semaines et livrable de démonstration uniquement.** La plateforme seule devient rationnelle. Il faut alors accepter quatre écarts au cahier et les écrire dans la recette.
2. **Obligation contractuelle d'utiliser ABA.** On inverse l'hybride : la plateforme devient l'entrée, LangGraph devient un service appelé pour l'état et le HITL.
3. **Absence de compétence TypeScript ou Node dans l'équipe.** La plateforme reste le seul chemin, avec une dette assumée et un périmètre réduit aux agents Support et Knowledge.

Aucun de ces trois cas ne correspond au contexte actuel : dix jours ouvrés, un développeur Node, et une recette qui exige le HITL.

## 11. Limites de cette note

La comparaison s'appuie sur l'interface de staging et sur la documentation publique, pas sur le code du fork ni sur un test de charge. Un test de HITL a été réalisé sur LangGraph.js : interruption, redémarrage complet du serveur, reprise sur `Command`, statut mis à jour. La vérification restante concerne la plateforme ABA : licence, politique de données et comportement d'une attente longue.

## 12. Mise en œuvre réelle

| Élément | Choix livré |
|---|---|
| Front et API | Next.js 16, route handlers Node |
| Orchestration | LangGraph.js 1.7, `StateGraph`, `interrupt`, `Command` |
| Persistance | PostgreSQL 18, `PostgresSaver` |
| Connaissance | 17 fiches multilingues, routeur documentaire et retrieval hybride de secours |
| Console | Next.js, file SLA, approbation et rejet |
| Support | Outils dossier, mes dossiers, perturbation de ligne |
| Conversation | LLM, prompt identité et capacités |
| Comptes | scrypt, sessions httpOnly, RBAC admin ou user |
| Modèle externe | NVIDIA NIM, `nemotron-3.5-bolt-e4b`, repli déterministe |
| Embeddings | `nemotron-3.5-embed-1b`, 1024 dimensions, 51 vecteurs précalculés |

Test de reprise effectué le 20 novembre : ticket créé, serveur arrêté, serveur relancé, approbation reçue, statut mis à jour. Les checkpoints ont survécu au redémarrage.

Écarts assumés : VoC sans segmentation par station, graphe métier non livré, pas de limitation de débit, notifications limitées à la publication dans le dossier, ordonnanceur limité aux relances d'abonnement en processus. Les décisions sont journalisées, les relances d'abonnement ciblées et automatiques, le routeur documentaire, le retrieval hybride et la classification stockée sont livrés. Le VoC couvre période, comparaison, export, drill-down thème et ligne, verbatims et CSAT. La proactivité couvre ligne, composeur trilingue, relance automatique, diffusion suivie et masquage. Le cycle de réclamation couvre discussion, clôture confirmée et feedback.

## Annexe, méthode et sources

La notation pondérée suit une grille de 1 à 5, appliquée aux mêmes critères pour les trois options. Les poids sont fixés avant notation, puis un test de sensibilité vérifie que le classement résiste à un changement de priorité.

1. Cahier des charges CasaMove v1.1, 20 novembre 2026.
2. Documentation LangGraph.js, persistance, interruptions, reprise et streaming.
3. Interface de staging Agentic d'ABA, observée le 17 novembre 2026.
4. Documentation publique de Langflow, composants, mode tool et expositions MCP.
5. Loi 09-08 relative à la protection des données personnelles au Maroc.
6. Documentation Next.js 16 et PostgreSQL 18.
7. Guide d'information voyageurs Casatramway & Casabusway, relevé du 17 novembre 2026.
