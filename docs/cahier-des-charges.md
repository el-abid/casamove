## Sommaire

1. Contexte et objet
2. Périmètre et hypothèses
3. Acteurs et parcours
4. Exigences fonctionnelles
5. Exigences non fonctionnelles
6. Architecture cible
7. Données et interfaces
8. Orchestration LangGraph.js
9. Connaissance et qualité des réponses
10. Sécurité et conformité
11. Planning et jalons
12. Recette et critères d'acceptation
13. Risques
14. Livrables et gouvernance
15. Annexe A, glossaire
16. Annexe B, sources

## Résumé exécutif

Le réseau CasaMove exploite un service client réparti entre un site institutionnel, un formulaire de contact, un standard téléphonique et un assistant WhatsApp. L'usager doit changer de canal pour obtenir une information ou déposer une réclamation, et le suivi de dossier n'existe pas en ligne.

Le présent projet construit une alternative : un assistant conversationnel intégré à la page d'accueil du site, disponible sans installation et sans quitter le navigateur, adossé à cinq agents spécialisés et à un superviseur. Le canal WhatsApp reste une extension ultérieure, pas un prérequis.

Le document fixe le périmètre, les exigences mesurables, l'architecture, le modèle de données, les contrats d'interface, le planning et la recette. Il sert de référence contractuelle entre l'équipe projet et le commanditaire pour les dix jours ouvrés de la V1.

| Indicateur | Valeur cible |
|---|---|
| Agents spécialisés | 5, plus 1 superviseur |
| Exigences fonctionnelles | 8, dont 6 Must |
| Exigences non fonctionnelles | 6, dont 5 Must |
| Durée de la V1 | 10 jours ouvrés |
| Cas de recette | 12 |
| Premier token, p95 | moins de 2 secondes |
| Exactitude RAG | 85 % minimum |
| Coût d'exploitation | moins de 300 MAD par mois |

> Décision d'architecture : LangGraph.js porte l'orchestration et l'état des dossiers. La V1 livrée utilise Next.js 16, LangGraph.js 1.7, Postgres 18 et un corpus local de dix-sept fiches issues du guide voyageurs 2026. La plateforme Agentic d'ABA reste une cible V2 pour le flow de connaissance. La justification figure dans la note séparée, qui accompagne ce cahier des charges.

## 1. Contexte et objet

### 1.1 Le réseau et le canal actuel

CasaMove est un opérateur de transport urbain à Casablanca, avec un réseau de tramway et de busway. Les informations publiques consultées le 17 novembre 2026 annoncent 151 stations et une fréquence moyenne de 8 minutes. Le site officiel du réseau organisé par RATP Dev Casablanca propose quatre entrées principales : à propos, se déplacer, ticket et abonnement, contact.

Le service client existe sur trois canaux. Le téléphone, du lundi au samedi de 8 h à 20 h. Un formulaire de contact. Un assistant virtuel multilingue sur WhatsApp, lancé pour couvrir horaires, lignes, itinéraires, cartes, abonnements et signalements.

### 1.2 Limites du dispositif actuel

Quatre limites motivent le projet.

1. **Rupture de canal.** L'usager qui consulte une ligne sur le site doit ouvrir WhatsApp pour poser sa question, puis revenir au site pour vérifier une information.
2. **Absence de suivi.** Une réclamation déposée sur WhatsApp ne produit ni numéro de dossier, ni échéance, ni historique consultable.
3. **Proactivité nulle.** Aucune alerte n'est poussée vers l'usager en cas de perturbation sur sa ligne ou d'expiration de son abonnement.
4. **Exploitation faible du feedback.** Les réclamations ne sont pas agrégées en thèmes et en sentiment, donc les causes récurrentes restent invisibles.

### 1.3 Objet du document

Ce cahier des charges décrit la V1 du service client augmenté : ce qui est livré, comment, dans quel délai, et selon quels critères on accepte le résultat. Il ne décrit pas l'application mobile, la boutique en ligne ni le canal WhatsApp.

### 1.4 Références

- Document de cadrage « Service Client », cas fil rouge Casa Transport, Casatramway et Casabusway.
- Site public du réseau, consulté le 17 novembre 2026.
- Documentation LangGraph.js, persistance, interruptions et reprise.
- Documentation Next.js 16 et PostgreSQL 18.
- Loi marocaine 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel.
- Interface de staging de la plateforme Agentic d'ABA, observée le 17 novembre 2026.

## 2. Périmètre et hypothèses

### 2.1 Inclus dans la V1

| Élément | Contenu | Statut |
|---|---|---|
| Page d'accueil | Reprise de la structure du site du réseau, marque fictive CasaMove, sans reprise d'asset | Livré |
| Assistant | Widget de chat intégré, trois langues, réponses sourcées, streaming | Livré |
| Réclamation | Formulaire conversationnel, ticket, priorisation, échéance SLA, suivi par numéro | Livré |
| Validation humaine | File d'attente, approbation, édition ou rejet avant envoi | Livré |
| Console agents | File SLA, dossier, brouillon, décision | Livré |
| Compte usager | Inscription, connexion, suivi de ses dossiers | Livré |
| Sécurité de la console | Authentification et RBAC admin ou user | Livré |
| VoC | Sentiment et thèmes stockés à la création, agrégés depuis Postgres | Livré |
| Proactivité | Alertes perturbation, information et renouvellement automatique poussées dans le chat | Livré |

### 2.2 Exclu de la V1

Le paiement et la recharge, l'application mobile native, l'intégration WhatsApp Business, la connexion aux systèmes internes de CasaMove, la voix et le téléphone, l'authentification des usagers par compte.

### 2.3 Hypothèses

1. Aucun accès aux back-offices de CasaMove. Les données de lignes, horaires et tarifs proviennent de sources publiques, figées dans un corpus versionné.
2. Un seul développeur, à temps plein, sur dix jours ouvrés.
3. La démonstration se fait sur un jeu de données de démonstration, sans donnée personnelle réelle.
4. Les agents appellent un modèle via NVIDIA NIM, avec un repli déterministe si l'appel échoue. La classification, la synthèse des réponses et la rédaction des brouillons passent par le modèle ; le retrieval et les règles métier restent dans le code.
5. La plateforme ABA reste une cible V2 pour le flow de connaissance. La V1 n'en dépend pas.

### 2.4 Contraintes

- Marque fictive CasaMove, aucun logo, photo ou police repris du site du réseau.
- Aucune donnée personnelle réelle en environnement de démonstration.
- Coût d'exploitation inférieur à 300 MAD par mois.
- Un seul déploiement Next.js, plus un cluster Postgres local géré par scripts.

## 3. Acteurs et parcours

### 3.1 Acteurs

| Acteur | Rôle | Accès |
|---|---|---|
| Usager | Consulte, questionne, dépose et suit une réclamation | Site public |
| Agent de niveau 1 | Traite la file, valide ou corrige les brouillons | Console, rôle agent |
| Superviseur | Arbitre les cas sensibles, surveille les SLA | Console, rôle superviseur |
| Responsable qualité | Analyse le VoC, ajuste le corpus | Console, lecture VoC |
| Système | Superviseur d'agents, RAG, planificateur SLA | Interne |

### 3.2 Parcours P1, information

1. L'usager ouvre la page d'accueil et clique sur le bouton d'assistant.
2. Il demande l'horaire du dernier tramway ligne 1 en français.
3. Le superviseur route vers l'agent Support, qui interroge le corpus via l'outil de connaissance.
4. La réponse s'affiche en streaming, avec la source et la date de mise à jour.
5. Si le score de pertinence est insuffisant, l'assistant propose le formulaire de réclamation.

### 3.3 Parcours P2, réclamation avec validation humaine

1. L'usager signale un retard récurrent et un comportement inadéquat.
2. L'agent Réclamation qualifie le motif, détecte le risque, crée un ticket et calcule l'échéance.
3. Le brouillon de réponse est produit, puis bloqué par une interruption avant publication.
4. L'agent humain publie, édite ou rejette dans la console.
5. Le dossier passe en cours. La conversation continue entre l'agent et l'usager.
6. Après accord de l'usager, l'agent clôture le dossier. Une note de satisfaction 1 à 5 est demandée.

### 3.4 Parcours P3, proactivité

1. Le planificateur détecte une perturbation publiée sur une ligne suivie.
2. L'agent Succès client prépare une alerte personnalisée.
3. La carte s'affiche à la prochaine ouverture du chat, avec la source officielle.
4. L'usager peut demander un itinéraire de remplacement en un clic.

### 3.5 Parcours d'échec

Si le modèle est indisponible, si la confiance d'intention est inférieure à 0,55 ou si la question sort du corpus, l'assistant l'annonce, propose le formulaire et crée un ticket de niveau 3. Aucune réponse inventée n'est envoyée.

## 4. Exigences fonctionnelles

### 4.1 Vue d'ensemble

| ID | Exigence | Priorité | Critère d'acceptation |
|---|---|---|---|
| F1 | Chat intégré à la page | Must | Le widget s'ouvre sans rechargement, la conversation survit à la navigation |
| F2 | Multilingue FR, AR, EN | Must | Les trois langues répondent, l'arabe s'affiche en RTL |
| F3 | Réponses sourcées | Must | Toute réponse factuelle cite au moins une source datée |
| F4 | Réclamation et ticket | Must | Un ticket est créé avec numéro, priorité et échéance |
| F5 | Validation humaine | Must | Aucun envoi de réclamation sans décision humaine tracée |
| F6 | Proactivité | Should | Une alerte de perturbation apparaît dans le chat |
| F7 | Console agents | Must | File triée par échéance, dossier consultable, décision enregistrée |
| F8 | VoC | Should | Sentiment et six thèmes agrégés sur une période |

### 4.2 F1, chat intégré

Le widget est accessible depuis toutes les pages, par un bouton fixe en bas à droite. Il conserve la conversation lors d'un changement de page, grâce à un identifiant de session en cookie. L'ouverture ne déclenche aucune navigation. La fermeture ne supprime pas l'historique de la session.

### 4.3 F2, multilingue

La langue est détectée sur le message, avec un sélecteur manuel qui prévaut. Les libellés de l'interface proviennent d'un dictionnaire typé, avec une clé obligatoire dans les trois langues, ce qui casse le build en cas d'oubli. L'arabe impose `dir="rtl"` sur le conteneur de conversation, y compris pour les messages mixtes.

### 4.4 F3, réponses sourcées

Chaque réponse factuelle porte une source lisible : nom du document, section, date de dernière mise à jour. Une réponse sans source au-dessus du seuil de pertinence est remplacée par une proposition d'escalade. Les sources sont affichées dans un panneau repliable, pas en note de bas de page.

### 4.5 F4, réclamation et ticket

Le parcours de réclamation collecte le motif, la ligne, la date, la description et un contact. Il produit un numéro lisible du type `CM-2026-000148`, une priorité et une échéance.

| Priorité | Motifs | Échéance |
|---|---|---|
| P1 | Sécurité, agression, perturbation majeure | 4 heures |
| P2 | Remboursement, abonnement, préjudice financier | 24 heures |
| P3 | Information, suggestion, retard isolé | 72 heures |

Le statut est consultable par numéro de ticket et par le même identifiant de session.

### 4.6 F5, validation humaine

Toute réponse de réclamation passe par une interruption avant publication. La console affiche le brouillon, la priorité, les sources et le motif d'escalade. Trois décisions sont possibles : publier tel quel, éditer puis publier, rejeter avec motif. Chaque décision est horodatée et signée par l'agent. La publication ouvre le dossier en `in_progress` ; elle ne le clôture pas. La clôture intervient après l'accord de l'usager, puis un feedback 1 à 5 est demandé.

### 4.7 F6, proactivité

Trois déclencheurs sont implémentés en V1 : perturbation publiée sur une ligne choisie, message d'information personnalisé, et abonnement qui expire dans sept jours. La relance de renouvellement est automatique : un contrôle au démarrage du serveur, puis toutes les 24 heures, cible les abonnements à sept jours de l'échéance, avec au plus une relance par usager et par jour et sans bouton manuel. L'admin choisit la ligne, la sévérité et, pour un message libre, les titres et corps en français, arabe et anglais. Les alertes apparaissent dans le chat, jamais par notification push. Les perturbations ne sont pas plafonnées ; les relances et informations sont limitées à une par usager ou session et par jour. Chaque diffusion est enregistrée avec livraison, lecture et masquage. Masquer signifie que l'usager a vu l'alerte et la ferme ; ce n'est pas une non-lecture.

### 4.8 F7, console agents

La console présente trois zones : file d'attente triée par échéance, dossier du ticket avec historique, panneau de décision. La file se filtre par statut, priorité et langue, avec recherche par numéro, thème ou demande, et pagination. Le dossier affiche l'usager, son abonnement, ses dossiers récents, l'agent assigné et le journal des actions. La conversation s'ouvre dans un panneau de chat dédié, séparé de la fiche. L'agent répond, demande la confirmation de clôture, puis clôture le dossier. Un badge, une bannière et une pastille signalent les nouveaux messages usager. Le chat usager affiche une notification système à chaque réponse de l'agent. L'usager peut noter sa satisfaction de 1 à 5. Un compteur de dépassement SLA et trois indicateurs de santé, Postgres, LLM et embeddings, sont visibles en permanence.

### 4.9 F8, VoC

Le tableau agrège les tickets par volume, thème, ligne, priorité, statut et sentiment. Les thèmes et le sentiment sont classés à la création par le modèle, avec une taxonomie imposée de six valeurs : ponctualité, information, propreté, sécurité, accessibilité, abonnement. La ligne est extraite du message à la création. Le repli lexical couvre l'échec du modèle. Le script `npm run tickets:reclassify` reclasse l'historique et recalcule les échéances SLA ; `npm run tickets:lines` rattache les anciens dossiers à leur ligne. Le sélecteur couvre 7 jours, 30 jours ou tout l'historique, avec comparaison à la période précédente. Le volume reste affiché sur sept jours. L'export CSV, le drill-down d'un thème ou d'une ligne vers la file et les trois verbatims négatifs par thème sont livrés. La segmentation par station reste en V2.

## 5. Exigences non fonctionnelles

### 5.1 Vue d'ensemble

| ID | Exigence | Priorité | Cible |
|---|---|---|---|
| NF1 | Performance | Must | Premier token p95 sous 2 s, réponse complète sous 8 s |
| NF2 | Disponibilité | Should | 99 % mensuel, dégradation gracieuse |
| NF3 | Accessibilité | Must | WCAG 2.2 niveau AA |
| NF4 | Sécurité et conformité | Must | Loi 09-08, rétention définie, PII masquées |
| NF5 | Auditabilité | Must | Journal en ajout seul, chaîne de hachage, rejeu |
| NF6 | Coût et exploitabilité | Must | Moins de 300 MAD par mois, un seul déploiement |

### 5.2 NF1, performance

Le premier token mesure le délai entre l'envoi du message et le premier fragment affiché. Il est mesuré côté serveur et côté client, et affiché dans la console d'administration. La page d'accueil vise un LCP sous 2,5 secondes sur une connexion 4G.

### 5.3 NF2, disponibilité

En cas d'indisponibilité du modèle, le chat bascule sur un message explicite et un formulaire de ticket. Il ne reste jamais bloqué sur un indicateur de chargement. Le flux SSE se termine toujours par un événement `done` ou `error`.

### 5.4 NF3, accessibilité

Navigation clavier complète, focus visible, contraste minimal de 4,5 pour 1, cible tactile de 44 pixels, région `aria-live` pour le streaming, libellés explicites sur les champs. Le contenu arabe est testé au clavier en RTL.

### 5.5 NF4, sécurité et conformité

Les données collectées sont limitées au nécessaire : prénom ou pseudonyme, langue, ligne, contenu du message, contact si l'usager le fournit. Les numéros de téléphone et adresses e-mail sont masqués dans les journaux. La rétention est de 90 jours pour les messages, 12 mois pour les tickets, 6 mois pour les journaux techniques. Une déclaration CNDP est à prévoir avant toute mise en production réelle.

### 5.6 NF5, auditabilité

Chaque étape du graphe est enregistrée sous forme de checkpoint horodaté. En V1, les tickets et les checkpoints en base permettent de reconstituer un dossier et de rejouer une décision. Le journal en ajout seul avec chaîne de hachage et le rejeu complet restent à livrer en V2.

### 5.7 NF6, coût et exploitabilité

Un front statique, une API dans le même déploiement Next.js, une base Postgres unique pour les tickets et les checkpoints. Le retrieval V1 combine un routeur documentaire LLM sur 17 fiches, des embeddings précalculés pour 51 passages et un repli lexical. Le budget inclut l'hébergement, le nom de domaine et les appels de modèle sur le volume de démonstration.

## 6. Architecture cible

### 6.1 Vue d'ensemble

```
Navigateur
  Next.js, page publique, widget chat, console agents
        |
        | HTTPS, SSE
        v
Next.js route handler /api/chat   (runtime Node)
        |
        +----> LangGraph.js, état, routage, interruption, reprise
        |           |
        |           +----> corpus multilingue, routeur documentaire
        |           |
        |           +----> flow Agentic ABA, cible V2
        |
        +----> Postgres 18, tickets et checkpoints LangGraph.js
```

### 6.2 Composants

| Composant | Technologie | Responsabilité |
|---|---|---|
| Site public | Next.js 16, CSS design system | Page d'accueil, widget, accessibilité |
| Console | Next.js, même déploiement | File SLA, dossier, décision |
| API | Route handlers Next.js, runtime Node | Streaming SSE, tickets, administration |
| Orchestration | LangGraph.js 1.7 | État partagé, routage, HITL, reprise |
| Connaissance | Corpus TypeScript, routeur LLM, embeddings JSON | 17 fiches du guide, 3 langues, citations |
| Modèle | NVIDIA NIM, `nemotron-3.5-bolt-e4b` | Classification, synthèse ancrée, brouillons |
| Persistance | Postgres 18, `PostgresSaver` | Tickets, checkpoints, reprise |
| Composants | Plateforme Agentic ABA | Flow de connaissance, cible V2 |

### 6.3 Choix techniques

Next.js est retenu pour garder une seule origine, un seul déploiement et un flux SSE simple. LangGraph.js est retenu parce qu'il offre les mêmes primitives que la version Python, `StateGraph`, checkpointer, `interrupt` et reprise, sans ajouter un second runtime. Le corpus V1 est assez petit pour un routeur documentaire LLM sur catalogue complet, avec embeddings et lexical en secours, sans magasin vectoriel. Postgres 18 porte à la fois les tickets et les checkpoints, ce qui rend la reprise vérifiable après un redémarrage complet du serveur.

### 6.4 Environnements

| Environnement | Usage | Données |
|---|---|---|
| Local | Développement, tests | Postgres local, port 5544, corpus public |
| Démo | Jury, client | Postgres local, tickets de démonstration |
| Production | Hors périmètre V1 | Non applicable |

Le cluster Postgres est dédié au projet, avec un répertoire de données `.pgdata` et une authentification locale limitée à la machine. Les scripts `npm run db:start`, `db:stop` et `db:status` gèrent son cycle de vie.

## 7. Données et interfaces

### 7.1 Modèle de données

Tables livrées en V1 :

| Table | Champs clés | Rôle |
|---|---|---|
| `tickets` | number, status, priority, theme, sentiment, line, locale, thread_id, user_id, assigned_to, assigned_at, user_query, draft, created_at, sla_deadline, resolved_at, csat_score, csat_at | Dossier, brouillon, assignation, ligne, clôture et CSAT |
| `checkpoints` | thread_id, checkpoint, metadata | État du graphe à chaque nœud |
| `checkpoint_blobs` | thread_id, channel, version, value | Valeurs sérialisées |
| `checkpoint_writes` | thread_id, task_id, idx, value | Écritures intermédiaires |
| `checkpoint_migrations` | version | Suivi du schéma LangGraph |
| `users` | id, email, password_hash, full_name, phone, role, locale | Comptes usagers et administrateurs |
| `sessions` | token_hash, user_id, expires_at | Sessions de connexion |
| `subscriptions` | user_id, plan, status, started_at, ends_at, auto_renew | Abonnement de démonstration, lecture seule |
| `signals` | kind, line, user_id, severity, created_by, created_by_email, payload, expires_at | Alertes globales, ciblées ou personnalisées |
| `signal_deliveries` | signal_id, user_id, session_id, delivered_at, read_at, dismissed_at | Diffusion, lecture et masquage d'une alerte |
| `ticket_decisions` | ticket_number, action, comment, admin_id, admin_email, created_at | Journal des décisions humaines |
| `ticket_events` | ticket_number, event, actor_id, actor_email, detail, created_at | Journal des actions, création et assignation comprises |
| `ticket_messages` | ticket_number, role, body, author_email, created_at | Conversation usager, agent et système |

Tables prévues en V2 :

| Table | Rôle |
|---|---|
| `audit` | Journal en ajout seul, chaîne de hachage |
| `document` | Corpus versionné et empreintes |
| `sla_event` | Échéances, relances, réassignations |

L'identifiant de conversation est généré côté navigateur et conservé dans `sessionStorage`. Le serveur en dérive un thread par message (`sessionId:uuid`) : un dossier en attente de validation ne bloque pas la conversation suivante.

### 7.2 Contrats d'interface

| Méthode | Route | Rôle | Statut |
|---|---|---|---|
| POST | `/api/chat` | Envoi d'un message, réponse SSE | Livré |
| GET | `/api/tickets` | File complète pour la console | Livré |
| GET | `/api/tickets/{number}` | Suivi usager, fiche et journal pour l'admin | Livré |
| POST | `/api/tickets/{number}/decision` | Publication ou rejet, reprise du graphe | Livré |
| GET | `/api/tickets/{number}/messages` | Conversation du dossier | Livré |
| POST | `/api/tickets/{number}/messages` | Réponse de l'agent depuis la console | Livré |
| POST | `/api/tickets/{number}/resolve` | Clôture avec accord de l'usager | Livré |
| POST | `/api/tickets/{number}/csat` | Note de satisfaction 1 à 5 | Livré |
| POST | `/api/tickets/{number}/assign` | Assignation ou désassignation d'un agent | Livré |
| GET | `/api/admin/agents` | Liste des agents administrateurs | Livré |
| GET | `/api/health/status` | Santé Postgres, LLM et embeddings | Livré |
| POST | `/api/auth/register` | Création d'un compte usager | Livré |
| POST | `/api/auth/login` | Connexion, session cookie | Livré |
| POST | `/api/auth/logout` | Fermeture de session | Livré |
| GET | `/api/auth/me` | Utilisateur courant | Livré |
| GET | `/api/voc` | Agrégats VoC par période et ligne, thèmes, priorités, volume et verbatims | Livré |
| GET | `/api/voc/export` | Export CSV de la période, éventuellement filtré par thème | Livré |
| GET | `/api/signals` | Alertes actives, filtrées par usager et session | Livré |
| POST | `/api/signals` | Publication d'une perturbation ou d'une information ; la relance d'abonnement est automatique et refusée en manuel | Livré |
| POST | `/api/signals/{id}/read` | Marque une alerte comme lue à l'ouverture du chat | Livré |
| POST | `/api/signals/{id}/dismiss` | Masquage d'une alerte par l'usager | Livré |

### 7.3 Événements SSE

| Événement | Charge utile | Usage |
|---|---|---|
| `meta` | session, intent, confiance | Début de traitement |
| `token` | fragment de texte | Streaming |
| `sources` | liste de documents cités | Panneau de sources |
| `ticket` | numéro, priorité, échéance | Carte de suivi |
| `hitl` | ticket, statut en attente | Message d'attente |
| `done` | latence, coût | Fin normale |
| `error` | code, message | Fin dégradée |

### 7.4 Rétention et purge

Une tâche planifiée quotidienne supprime les messages au-delà de 90 jours, anonymise les tickets au-delà de 12 mois et purge les journaux au-delà de 6 mois. La purge est journalisée et ne peut pas être désactivée depuis l'interface.

## 8. Orchestration LangGraph.js

### 8.1 État partagé

```ts
const AgentState = Annotation.Root({
  query: Annotation<string>(),
  locale: Annotation<Locale>(),
  sessionId: Annotation<string>(),
  intent: Annotation<Intent>(),
  confidence: Annotation<number>(),
  reply: Annotation<string>(),
  sources: Annotation<Source[]>({ reducer: (_c, next) => next, default: () => [] }),
  ticket: Annotation<Ticket | null>({ reducer: (_c, next) => next, default: () => null }),
  decision: Annotation<HitlDecision | null>({ reducer: (_c, next) => next, default: () => null }),
});
```

Le superviseur remet à zéro `reply`, `sources`, `ticket` et `decision` à chaque nouveau tour, ce qui évite qu'un dossier traité réapparaisse dans la conversation suivante.

### 8.2 Nœuds

| Nœud | Rôle | Sortie |
|---|---|---|
| `supervisor` | Classifie par règles lexicales, remet l'état à zéro, route | `intent`, `confidence` |
| `knowledge` | Routeur documentaire, retrieval hybride de secours, réponse citée | `reply`, `sources` |
| `complaint` | Qualifie, crée le ticket en base, prépare le brouillon | `ticket` |
| `hitl` | Suspend avant envoi, reprend sur `Command` | `decision` |
| `support` | Répond aux demandes transactionnelles : statut d'un dossier, mes dossiers, perturbation de ligne | `reply`, `ticket` |
| `conversation` | Répond aux salutations, à l'identité et aux capacités de l'assistant | `reply` |

Les agents Success et VoC tournent hors du graphe conversationnel : Success via le service de signaux, VoC via l'agrégation des tickets. Le superviseur ne les appelle pas.

### 8.3 Routage

Le superviseur appelle le modèle NVIDIA pour classer le message en information, réclamation, support, conversation ou inconnu, avec une confiance retournée. Si l'appel échoue ou renvoie un format invalide, un classifieur lexical par langue prend le relais avec les seuils 0,9, 0,85 et 0,4. Une puce Réclamation peut aussi forcer l'intention côté client, sans phrase préfabriquée : le ticket reprend alors le texte exact de l'usager. L'issue support couvre les demandes transactionnelles, traitées par des outils : statut d'un dossier, liste de ses dossiers, perturbation active sur une ligne. L'issue conversation couvre les salutations, l'identité de l'assistant, ses capacités et les remerciements, sans retrieval ni ticket.

### 8.4 Validation humaine

`hitl` appelle `interrupt()` avec le ticket et le brouillon. La console appelle `POST /api/tickets/{number}/decision`, qui reprend le graphe avec `Command({ resume: { action, comment } })` sur le même `thread_id`. En V1, aucune relance automatique d'échéance SLA : les dépassements sont visibles dans la file. La relance d'abonnement, elle, est automatique. Le planificateur externe reste au périmètre V2.

### 8.5 Persistance et reprise

Le checkpointer `PostgresSaver` enregistre l'état à chaque nœud dans Postgres. Chaque message ouvre un thread court, formé de l'identifiant de session et d'un UUID. Le dossier en attente conserve son propre thread dans `ticket.thread_id`, ce qui permet à la console de le reprendre sans bloquer la conversation. Test effectué le 20 novembre : ticket créé, messages suivants traités normalement, approbation reçue après redémarrage, statut mis à jour.

### 8.6 Erreurs

Le flux SSE se termine toujours par un événement `done` ou `error`. Une erreur de graphe est journalisée côté serveur et renvoyée comme événement `error`, puis le client affiche un message de reprise. Les retries par nœud et le disjoncteur restent au périmètre V2.

## 9. Connaissance et qualité des réponses

### 9.1 Corpus

| Source | Contenu | Format |
|---|---|---|
| Corpus applicatif | 17 fiches : réseau, horaires, tarifs, achat, abonnement, correspondances, stations de correspondance, règles, accessibilité, objets perdus, agences, fréquences, lignes, procédure de réclamation, suivi, contact, réclamation | TypeScript, `lib/agent/corpus.ts` |
| Embeddings | 51 vecteurs, 17 fiches × 3 langues, 1024 dimensions | JSON, `lib/agent/embeddings.json` |

Chaque fiche porte un titre, un corps et une source par langue. Le corpus est versionné dans le dépôt, et la source affichée dans le chat est localisée.

### 9.2 Ingestion

Les fiches restent la source de vérité. La commande `npm run embeddings:build` encode chaque fiche dans les trois langues avec `nvidia/nemotron-3.5-embed-1b`, en 1024 dimensions, puis écrit `lib/agent/embeddings.json`. Le fichier contient le modèle, la taille, un hash du corpus et 51 vecteurs. Il est chargé en mémoire au démarrage. Si le hash ne correspond plus au corpus, le retrieval ignore les vecteurs et repasse au lexical. Aucune base vectorielle n'est nécessaire pour 17 fiches.

### 9.3 Retrieval

Le routeur documentaire est la couche principale quand le modèle est disponible. Il reçoit la question et le catalogue complet des 17 fiches, avec titre, mots-clés et corps. Il sélectionne au maximum trois fiches et doit citer pour chacune une phrase exacte du corps. La citation est vérifiée comme sous-chaîne du document ; une fiche dont la preuve ne correspond pas est écartée. Si aucune fiche ne répond, l'assistant refuse.

Le retrieval hybride reste le repli quand le modèle est indisponible ou échoue :

1. Le score lexical donne 2 points par mot-clé présent et 1 point par mot commun avec le titre ou le corps, sans double comptage.
2. Le score dense est le cosinus entre l'embedding de la question et celui de la fiche, par langue.
3. La fusion pondère le lexical normalisé à 0,65 et le dense à 0,35.
4. Si le lexical est faible mais que le dense confirme la même fiche, la réponse est acceptée.
5. Sinon, le message de repli est renvoyé.

Les résultats du routeur sont mis en cache par question normalisée. Les alias du corpus restent utiles au repli lexical, mais ils ne sont plus le mécanisme principal. Le nœud Knowledge transmet les fiches sélectionnées au modèle avec interdiction d'ajouter des faits. Les sources sont renvoyées séparément et les refus ne portent aucune source.

### 9.4 Évaluation

| Indicateur | Seuil | Méthode |
|---|---|---|
| Exactitude | 85 % | Jeu de questions de référence, notation humaine |
| Citation | 100 % des réponses factuelles | Vérification automatique |
| Affirmation non étayée | moins de 5 % | Relecture de 20 réponses |
| Refus correct | 100 % sur 5 questions hors corpus | Jeu dédié |
| Routage | 90 % | Jeu de 30 phrases |

Le jeu de recette couvre les reformulations, l'arabe, l'anglais, les refus et les pannes d'API. Le smoke test `npm run test:smoke` vérifie le routeur documentaire et le retrieval dense avec l'API réelle, sur 9 cas. Les 108 tests locaux tournent sans réseau, avec `EMBEDDINGS_ENABLED=false`.

## 10. Sécurité et conformité

### 10.1 Données personnelles

Collecte minimale, pas de compte usager en V1, pas de géolocalisation. Le contact n'est demandé que pour une réclamation, et il est facultatif.

### 10.2 Base légale et consentement

Le traitement repose sur l'exécution du service demandé. Un encart explique l'usage des données avant le premier message. Aucune donnée n'est utilisée pour entraîner un modèle. Une déclaration CNDP est requise avant mise en production.

### 10.3 Journalisation

Les numéros de téléphone, adresses e-mail et numéros de carte sont masqués avant écriture. Les journaux ne contiennent jamais le contenu brut d'une réclamation sensible, seulement son empreinte.

### 10.4 Accès

Authentification par email et mot de passe. Les mots de passe sont hachés avec scrypt, les sessions vivent dans un cookie httpOnly de sept jours et le jeton est stocké haché en base. Deux rôles : user pour les usagers, admin pour la console. La console et ses API refusent tout compte non admin, par redirection vers `/login` ou erreur 403. Les comptes admin sont créés par `npm run db:admin`, jamais par le formulaire public. Limites V2 : pas de limitation de débit, pas de double facteur, pas de journal des connexions.

### 10.5 Propriété intellectuelle

La marque CasaMove est fictive. Aucun logo, photo, icône ou police du site du réseau n'est réutilisé. Les données factuelles publiques sont citées avec leur source et leur date.

## 11. Planning et jalons

| Phase | Travaux | Statut |
|---|---|---|
| J1 et J2 | Page d'accueil, header, hero, tuiles, actus, footer, trois langues | Livré |
| J3 | Widget chat, streaming réel, réponses rapides, RTL | Livré |
| J4 et J5 | Graphe superviseur, agents Support et Knowledge, RAG, SSE | Livré |
| J6 et J7 | Réclamation, ticket, SLA, interruption, console de décision | Livré |
| J8 | VoC, agrégats, classification stockée | Livré |
| J9 | Proactivité, alertes, composeur et suivi de diffusion | Livré |
| J10 | Plateforme ABA, comparaison, répétition de la démo, PDF | Partiel : démo et PDF prêts, flow ABA non branché |
| J11 | Authentification, RBAC, comptes usagers | Livré |
| J12 | Agents LLM NVIDIA, repli déterministe | Livré |

Chaque jalon se termine par une démonstration de dix minutes et une liste d'écarts. Un jalon non tenu se rattrape le jour suivant, jamais en réduisant la recette.

## 12. Recette et critères d'acceptation

### 12.1 Stratégie

Tests unitaires sur le routage et les outils, tests d'intégration sur les routes, tests de bout en bout sur les trois parcours, évaluation du RAG sur un jeu de questions de référence. Les tests tournent en local et en intégration continue.

### 12.2 Cas de recette

| ID | Scénario | Attendu |
|---|---|---|
| T01 | Horaire de la ligne 1 en français | Réponse citée, source datée |
| T02 | Même question en arabe | Réponse en arabe, rendu RTL correct |
| T03 | Question hors corpus | Refus explicite, proposition de ticket |
| T04 | Tarif étudiant | Montant exact, source citée |
| T05 | Réclamation pour retard | Ticket P3, échéance 72 h |
| T06 | Réclamation pour agression | Ticket P1, échéance 4 h, HITL |
| T07 | Publication du brouillon | Dossier en cours, décision tracée |
| T08 | Édition puis publication | Version éditée en base, historique complet |
| T09 | Dépassement de 4 h sans décision | Réassignation au superviseur |
| T10 | Coupure du modèle | Message dégradé, ticket créé, pas de blocage |
| T11 | Injection de prompt | Refus, journalisation, aucune fuite |
| T12 | Accès console sans rôle | Refus 403, tentative journalisée |
| T13 | Discussion puis clôture | Messages échangés, dossier résolu après accord |
| T14 | Feedback de satisfaction | Note 1 à 5 stockée et agrégée dans le VoC |

État au 24 novembre : T01 à T08, T13 et T14 sont validés. T12 est partiellement couvert : refus par redirection et erreur 403. T09, T10 et T11 restent hors V1 : pas de relance SLA à l'échéance, pas de test de coupure ni d'injection.

### 12.3 Critères d'acceptation

1. Les six exigences fonctionnelles Must passent leur critère.
2. Aucun cas de recette bloquant en échec.
3. Premier token sous 2 secondes au 95e centile sur le jeu de démonstration.
4. Exactitude RAG supérieure ou égale à 85 %.
5. Aucune donnée personnelle en clair dans les journaux.
6. Parcours clavier complet sur les trois langues.

## 13. Risques

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Données de transport obsolètes | Élevée | Moyen | Source affichée, revue du corpus, date de mise à jour |
| Écart entre le corpus et la réalité terrain | Moyenne | Élevé | Fiches datées, revue trimestrielle, refus hors seuil |
| Indisponibilité de Postgres | Faible | Élevé | Scripts `db:start` et `db:status`, données persistées |
| Accès non protégé à la console | Moyenne | Moyen | Réseau local, authentification avant production |
| Charge de démonstration | Faible | Moyen | File d'attente, limite de débit en V2 |
| Contournement de la validation | Faible | Critique | Interruption obligatoire, décision tracée, tests T05 à T08 |

## 14. Livrables et gouvernance

### 14.1 Livrables

1. Dépôt Git avec le front, l'API, le graphe, le corpus et les scripts de base.
2. Ce cahier des charges et la note de justification, en PDF.
3. Jeu de recette de 12 cas et résultats des tests manuels.
4. Script de démonstration de cinq minutes.
5. Console agents et cluster Postgres de démonstration.

### 14.2 Points de décision

| Date | Décision | Décideur |
|---|---|---|
| J2 | Validation du rendu visuel | Commanditaire |
| J5 | Validation du périmètre RAG | Commanditaire et qualité |
| J7 | Validation du parcours de réclamation | Commanditaire |
| J10 | Recette finale | Commanditaire |

### 14.3 Gouvernance

Un point de quinze minutes chaque matin, un compte rendu écrit chaque soir, une revue de jalon. Toute demande hors périmètre est consignée et traitée après la V1.

## 15. Annexe A, glossaire

| Terme | Définition |
|---|---|
| HITL | Human in the loop, validation humaine avant une action sensible |
| RAG | Retrieval augmented generation, réponse adossée à des documents |
| SLA | Engagement de délai de traitement |
| SSE | Server-sent events, flux de réponse en streaming |
| Checkpointer | Mécanisme qui enregistre l'état du graphe à chaque étape |
| VoC | Voice of customer, analyse des retours usagers |
| TTFT | Time to first token, délai avant le premier fragment |
| RTL | Right to left, sens de lecture arabe |

## 16. Annexe B, sources

1. Document de cadrage « Service Client », cas fil rouge Casa Transport.
2. Site public du réseau de tramway et busway de Casablanca, consulté le 17 novembre 2026.
3. Documentation LangGraph.js, sections persistance, interruptions et reprise.
4. Loi 09-08 relative à la protection des données personnelles au Maroc.
5. Interface de staging Agentic d'ABA, observée le 17 novembre 2026.
6. Documentation Next.js 16 et PostgreSQL 18.
7. Guide d'information voyageurs Casatramway & Casabusway, relevé du 17 novembre 2026.
