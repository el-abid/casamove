## Avant de commencer, T moins 10 minutes

Trois commandes, dans cet ordre, depuis `casamove/`.

```bash
npm run db:status
npm run db:seed
npm run start
```

`db:seed` remplace les 24 dossiers de démonstration. À lancer une fois le jour de la soutenance, pour que la VoC affiche un volume crédible.

Lancer ces commandes dans une fenêtre PowerShell dédiée et laisser la fenêtre ouverte. Si le cluster est démarré depuis un terminal d'agent, un redémarrage de session peut l'arrêter. `db:status` doit répondre « acceptation des connexions » avant d'ouvrir le site.

Ouvrir `/login` et se connecter avec le compte administrateur créé par `npm run db:admin` (mot de passe communiqué hors document). La session dure sept jours, donc la console s'ouvrira sans mot de passe le jour J.

Les agents appellent le modèle NVIDIA via `NVIDIA_API_KEY`, présente dans l'environnement. Le retrieval hybride utilise aussi `nvidia/nemotron-3.5-embed-1b` pour encoder la question. Les 51 vecteurs des fiches sont précalculés dans `lib/agent/embeddings.json` ; après une modification du corpus, lancer `npm run embeddings:build`. Pour reclasser l'historique des dossiers après une modification des règles, lancer `npm run tickets:reclassify`. Sans réseau, le système bascule sur le lexical et les réponses du corpus : la démo reste debout.

Deux fenêtres côte à côte, pas d'onglets cachés.

| Fenêtre | URL | Rôle |
|---|---|---|
| Gauche | `http://localhost:3000/fr` | Site et chat, côté usager |
| Droite | `http://localhost:3000/admin` | Console, session admin ouverte |

Vérifications en 30 secondes : le chat s'ouvre, la console liste les dossiers, l'onglet VoC affiche les dossiers de démonstration.

## Déroulé, 5 minutes

| Temps | Action | Ce que le jury voit |
|---|---|---|
| 0:00 | Parler, sans clic | Le problème : WhatsApp, pas de dossier, pas de suivi |
| 0:30 | Montrer la page, passer en arabe, revenir en français | Le même service en trois langues, RTL compris |
| 1:10 | Ouvrir le chat, cliquer « Horaires » | Réponse sourcée, sans quitter le site |
| 2:00 | Cliquer « Réclamation », décrire le problème | Ticket créé avec le texte exact de l'usager |
| 2:40 | Passer à la console, approuver | Décision humaine, brouillon validé |
| 3:20 | Revenir au chat, puis demander le statut du dossier | Notification de validation et réponse Support |
| 3:45 | Onglet Voix du client | Thèmes, priorités, volume, sentiment |
| 4:20 | Onglet Proactivité, publier une perturbation | Alerte poussée dans le chat |
| 4:50 | Conclure | Cinq agents, archi LangGraph.js et Postgres |

## Étape par étape

### 1. Le problème, 30 secondes

Phrase à dire, sans lire : « Aujourd'hui, l'usager consulte une ligne sur le site, puis doit ouvrir WhatsApp pour poser sa question. Sa réclamation ne reçoit ni numéro, ni échéance, ni suivi. »

### 2. La page, 40 secondes

Cliquer sur `AR` dans la barre du haut. Montrer que la page passe en RTL, y compris le chat. Revenir sur `FR`.

Ne pas commenter le design. Le point à faire passer est la continuité de canal.

### 3. Question d'information, 50 secondes

1. Cliquer sur le bouton « Une question ? » en bas à droite.
2. Cliquer sur la puce « Horaires ».
3. Laisser la réponse s'écrire.

Réponse attendue : « Le service circule tous les jours de 5h30 à 22h30. Les premiers départs sont à 5h30 des terminus, les derniers à 22h30, sauf sur le busway où les derniers trajets partent à 22h00 vers Omar El Khayam et Oulmes. »

Source affichée : « Guide voyageurs 2026, relevé du 17/11/2026 ».

Enchaîner avec « Jusqu'à quand les rames circulent-elles ? ». Le routeur documentaire retrouve la fiche horaires sans mot-clé exact.

Tester aussi « Où se trouve l'agence la plus proche ? » : le routeur choisit la fiche Agences, pas la fiche Objets perdus.

Dire : « La réponse est ancrée sur le corpus, pas inventée. Le modèle reformule, et la source reste affichée. Si aucun document ne répond, l'assistant refuse et propose un dossier. »

### 4. Réclamation, 50 secondes

1. Cliquer sur la puce « Réclamation ».
2. Le bot demande la description, aucun message n'est envoyé à sa place.
3. Taper « Le tram de 7h40 était supprimé sans information » et envoyer.
4. Montrer la carte de dossier.

Réponse attendue : « Votre réclamation est enregistrée sous le numéro CM-2026-000xxx. Priorité P3, réponse attendue avant le … Un agent valide le brouillon avant publication. »

Dire : « Rien n'est envoyé à ce stade. Le graphe est suspendu sur une interruption, en attente d'un humain. »

### 5. Console, 60 secondes

Passer à la fenêtre de droite.

1. Montrer les filtres statut, priorité et langue, la recherche et la pagination. Filtrer sur « En attente ».
2. Ouvrir le dossier, montrer la fiche usager avec l'abonnement et les dossiers récents.
3. Assigner le dossier à l'agent connecté, puis montrer la ligne « Assigné » dans le journal.
4. Cliquer sur « Publier la réponse ».

Montrer le passage à « En cours », la conversation avec le message de l'agent et les pastilles DB, LLM et Emb en haut. Cliquer sur « Ouvrir la conversation » : le chat s'ouvre dans un panneau dédié, séparé de la fiche.

Côté usager, le chat affiche « Nouveau message de l'agent » avant la réponse. Côté console, un badge et une bannière signalent le message usager.

### 6. Discussion, clôture et CSAT, 60 secondes

1. Dans le panneau de conversation, cliquer sur « Demander confirmation ».
2. Revenir au chat : l'usager reçoit la question « Est-ce que je peux vous aider avec autre chose ? ».
3. Répondre « non c'est bon merci ».
4. Revenir à la console : le message de l'usager apparaît, avec le badge « Nouveau message usager ».
5. Cliquer sur « Clôturer le dossier ».

Le chat affiche « Dossier clôturé avec l'accord de l'usager », puis une carte indépendante avec cinq étoiles. Cliquer sur la quatrième étoile.

Ouvrir « Mon compte » : le dossier passe à « Clôturé » et la réponse figure dans « Réponses publiées ».

Dire : « La publication ne clôture plus le dossier. La clôture vient de l'accord de l'usager. La note 1 à 5 est stockée et agrégée dans le VoC. »

### 7. Voix du client, 50 secondes

Console, onglet « Voix du client ».

1. Montrer le sélecteur 7 jours / 30 jours / Tout et la variation par rapport à la période précédente.
2. Montrer les cinq chiffres : dossiers analysés, connotation négative, thème dominant, en attente et satisfaction moyenne sur 5.
3. Montrer les barres par thème, par ligne, les priorités, le volume sur sept jours, le sentiment négatif, neutre, positif et la distribution CSAT.
4. Cliquer sur « Sécurité » : la file s'ouvre filtrée sur ce thème. Revenir à la VoC.
5. Cliquer sur « Ligne 2 » : la file s'ouvre filtrée sur cette ligne. Revenir à la VoC.
6. Choisir « propreté » dans les verbatims et montrer les trois citations négatives.
7. Cliquer sur « Exporter CSV ».

Dire : « Le thème, la priorité et le sentiment sont classés à la création par le modèle, avec un repli lexical. La ligne est extraite du message. Le script `tickets:reclassify` a recalé l'historique et `tickets:lines` a rattaché les anciens dossiers. Les dossiers 161 et 169, avec insulte, sortent maintenant en sécurité, P2, négatif. »

### 8. Proactivité, 45 secondes

Console, onglet « Proactivité ».

1. Montrer la carte « Renouvellement d'abonnement » : elle indique « automatique » et la dernière relance.
2. Choisir la ligne 2 dans le sélecteur, puis cliquer sur « Publier la perturbation ».
3. Revenir au chat, attendre douze secondes.
4. Cliquer sur « Masquer » dans l'alerte.
5. Revenir à la console : la ligne affiche « 100 % lus, 1 livré, 1 masqué ».

Le chat affiche « Alerte proactive, Perturbation ligne 2 » avec le texte d'itinéraire de remplacement.

Montrer aussi le composeur : un titre et un message en FR, AR et EN, une sévérité et une ligne.

Dire : « L'agent Succès client parle avant qu'on lui demande. La perturbation est limitée à la ligne choisie. Le rappel de renouvellement est automatique : un contrôle au démarrage du serveur, puis toutes les 24 heures, cible les abonnements qui expirent sous sept jours. Le compte étudiant le reçoit, le compte mensuel non. Chaque diffusion est suivie, avec un bouton Masquer. Les perturbations ne sont pas plafonnées ; les relances sont limitées à une par usager et par jour. »

### 9. Conclusion, 10 secondes

« Cinq agents, un superviseur, un état durable, une validation humaine et une base unique. Le tout tourne sur Next.js, LangGraph.js et Postgres. »

## Plan B

| Symptôme | Geste |
|---|---|
| Le chat ne répond pas | `npm run db:status`, puis `npm run db:start` si besoin, et renvoyer le message |
| Le dossier n'apparaît pas | Cliquer sur « Rafraîchir » dans la console |
| La réponse n'apparaît pas | Demander le statut du dossier dans le chat, puis vérifier « Réponses publiées » dans Mon compte |
| L'alerte ne vient pas | Attendre douze secondes, puis vérifier la liste des alertes récentes |
| Numéro de dossier inattendu | Ne pas le commenter, dire « un numéro de dossier » |

Ne jamais relancer `npm run db:seed` pendant la démo : les dossiers seed changent d'identifiants et la file se recharge.

## Questions probables du jury

1. **Pourquoi LangGraph.js et pas la plateforme ABA seule ?** Les exigences F5, F6, F7 et NF5 demandent un état durable, une interruption, une file et un journal. La matrice de décision donne 4,25 pour LangGraph.js contre 2,75 pour la plateforme seule.
2. **Pourquoi pas Python ?** Python n'est pas installé sur la machine de démonstration, et LangGraph.js offre les mêmes primitives, sans second runtime. Le graphe est le même.
3. **Comment évitez-vous les hallucinations ?** Les questions d'information passent par un routeur documentaire qui voit les dix-sept fiches et doit citer une phrase exacte du corps pour chaque fiche sélectionnée. La citation est vérifiée comme sous-chaîne du document. Le retrieval hybride lexical et dense sert de secours si le modèle échoue. Sans fiche pertinente, l'assistant refuse et propose un dossier.
4. **Les données survivent-elles à un redémarrage ?** Oui. Test effectué : ticket créé, serveur arrêté, serveur relancé, approbation reçue, statut mis à jour. Les checkpoints sont dans Postgres.
5. **Que manque-t-il ?** Le graphe métier, un modèle de sentiment, la limitation de débit, les notifications e-mail ou SMS et le déploiement.
6. **Comment protégez-vous les comptes ?** Mots de passe hachés avec scrypt, sessions en cookie httpOnly de sept jours, deux rôles. La console et ses API refusent un compte non administrateur.
7. **Combien d'agents ?** Quatre agents actifs dans le graphe : superviseur, Support, Knowledge, Complaint. Success et VoC tournent hors du graphe, sur les signaux et les tickets. Success cible désormais les abonnements proches de l'échéance.
8. **Comment le code est-il organisé ?** `app/` porte les routes, `components/` l'UI par domaine, `lib/` la logique métier, `tests/` la recette. La console est découpée en coquille, indicateurs, file, fiche et modal. Le README et `docs/architecture.md` décrivent les couches et les règles de dépendance.

## Après la démonstration

Laisser les deux fenêtres ouvertes. Si une question porte sur le code, ouvrir `lib/agent/graph.ts` et montrer `StateGraph`, `interrupt` et `PostgresSaver`, puis `components/admin/` pour la séparation entre coquille, file, fiche et conversation, pas l'interface.
