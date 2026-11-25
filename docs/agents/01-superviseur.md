## En 30 secondes

Le Superviseur est le premier agent à voir chaque message. Il ne rédige pas la réponse finale. Il lit la demande, devine l'intention, classe le dossier, puis choisit l'agent qui doit continuer.

Son travail tient en trois questions :

1. Que veut l'usager ? Une information, une réclamation, un suivi ou une simple conversation ?
2. Quel est le sujet ? Ponctualité, propreté, sécurité, accessibilité, abonnement ou information ?
3. Quelle est l'urgence ? P1, P2 ou P3, avec un sentiment négatif, neutre ou positif.

Il renvoie ensuite une seule route : `knowledge`, `complaint`, `support` ou `conversation`.

> À retenir : le Superviseur ne décide pas du contenu de la réponse. Il décide de la direction.

## Où vit le code

| Fichier | Rôle |
|---|---|
| `lib/agent/graph.ts` | Déclare l'état, le nœud `supervisor`, la fonction `route` et assemble le graphe |
| `lib/agent/classification.ts` | Règles lexicales, thèmes autorisés, priorités, sentiments |
| `app/api/chat/route.ts` | Reçoit le message, construit l'état et appelle `graph.invoke` |
| `lib/agent/llm.ts` | Appelle le modèle avec `chatJSON` et un délai maximal |
| `lib/db.ts` | Fournit la connexion Postgres utilisée par le checkpoint LangGraph |

## Le trajet d'un message

1. Le navigateur envoie le message à `POST /api/chat`.
2. La route construit un état avec le texte, la langue, la session, l'usager et un éventuel indice de réclamation.
3. LangGraph démarre toujours sur le nœud `supervisor`.
4. Le Superviseur produit l'intention, le thème, la priorité et le sentiment.
5. La fonction `route` transforme l'intention en nom de nœud.
6. LangGraph suit l'arête conditionnelle vers Knowledge, Réclamation, Support ou Conversation.
7. Le nœud choisi écrit la réponse, puis le graphe se termine.

## Le code, étape par étape

### Étape 1 : un état partagé

Tous les agents lisent et écrivent dans le même objet d'état. C'est cet objet qui transporte la question, la classification et la réponse.

```lib/agent/graph.ts
const AgentState = Annotation.Root({
  query: Annotation<string>(),
  locale: Annotation<Locale>(),
  sessionId: Annotation<string>(),
  userId: Annotation<number | null>({ reducer: (_c, n) => n, default: () => null }),
  intent: Annotation<Intent>(),
  confidence: Annotation<number>(),
  theme: Annotation<string>({ reducer: (_c, n) => n, default: () => "information" }),
  priority: Annotation<Priority>({ reducer: (_c, n) => n, default: () => "P3" }),
  sentiment: Annotation<TicketSentiment>({ reducer: (_c, n) => n, default: () => "neutral" }),
  reply: Annotation<string>(),
  sources: Annotation<Source[]>({ reducer: (_c, n) => n, default: () => [] }),
  ticket: Annotation<Ticket | null>({ reducer: (_c, n) => n, default: () => null }),
  decision: Annotation<HitlDecision | null>({ reducer: (_c, n) => n, default: () => null }),
});
```

Chaque champ a une valeur par défaut. Sans cela, un nœud qui ne remplit pas `theme` ferait planter la suite du graphe.

### Étape 2 : l'entrée dans le graphe

La route API crée un thread différent pour chaque message. Un dossier en attente de validation humaine ne bloque donc pas la conversation suivante.

```app/api/chat/route.ts
const threadId = `${sessionId}:${randomUUID()}`;
const config = { configurable: { thread_id: threadId } };

const values = await graph.invoke(
  {
    query: message,
    locale,
    sessionId: threadId,
    userId: currentUser?.id ?? null,
    intentHint,
  },
  config
);
```

Le `thread_id` est la clé du checkpoint Postgres. C'est lui qui permet de retrouver un graphe suspendu plus tard.

### Étape 3 : la classification lexicale rapide

Avant d'appeler le modèle, le Superviseur teste des expressions régulières. C'est rapide, déterministe et testable.

```lib/agent/graph.ts
const status = /(cm-\d{4}-\d{6}|statut|mon dossier|mes dossiers|suivi)/.test(q);
const complaint = /(reclam|plainte|signaler|retard|agress|incident|panne|rembours)/.test(q);
const traffic = /(perturb|disruption|trafic|traffic)/.test(q);
const info = /(horaire|tarif|prix|abonnement|etudiant|ligne|tram|bus|itineraire)/.test(q);
```

L'ordre des tests compte. Un message qui parle de « retard » est une réclamation avant d'être une question d'horaires.

### Étape 4 : le modèle affine le choix

Si le LLM est activé, `supervisor` demande une réponse JSON stricte. Le prompt contient la taxonomie complète et des exemples.

```lib/agent/graph.ts
const result = await chatJSON<{
  intent?: string;
  confidence?: number;
  theme?: string;
  priority?: string;
  sentiment?: string;
}>(
  [
    { role: "system", content: `Tu es le superviseur d'un service client de transport.
Classe le message dans une intention : information, reclamation, support, conversation ou inconnu.
Réponds uniquement par un JSON valide :
{"intent":"information|reclamation|support|conversation|inconnu","confidence":0.0,
 "theme":"ponctualité|information|propreté|sécurité|accessibilité|abonnement",
 "priority":"P1|P2|P3","sentiment":"negative|neutral|positive"}` },
    { role: "user", content: state.query },
  ],
  { maxTokens: 180, temperature: 0.1, timeoutMs: 8_000 }
);
```

Le modèle ne reçoit pas la base de données. Il ne fait que classer un texte. La température basse et le JSON strict réduisent les réponses fantaisistes.

### Étape 5 : les garde-fous de validation

Le résultat du modèle n'est jamais utilisé tel quel. Les intentions sont traduites vers les valeurs internes, puis les trois champs de classification sont validés.

```lib/agent/graph.ts
const intent =
  result?.intent === "reclamation" ? "complaint" :
  result?.intent === "information" ? "info" :
  result?.intent === "support" ? "support" :
  result?.intent === "conversation" ? "conversation" : null;

if (!intent) {
  return { ...rules, ...lexical, ...reset };
}

const classification = normalizeClassification(result ?? {}, state.query);
return { intent, confidence, ...classification, ...reset };
```

Si le modèle renvoie un thème inconnu, `normalizeClassification` garde la valeur lexicale. Si le modèle tombe en panne, le Superviseur continue avec les règles.

### Étape 6 : les cas particuliers

Deux règles méritent d'être connues.

La première concerne le bouton « Réclamation » du chat. Quand l'usager le clique, la route envoie `intentHint: "complaint"`. Le Superviseur force alors l'intention, sans attendre le modèle.

```lib/agent/graph.ts
if (state.intentHint === "complaint") {
  return { intent: "complaint", confidence: 1, ...lexical, ...reset };
}
```

La seconde concerne les questions de procédure. « Comment déposer une réclamation ? » contient le mot « réclamation », mais ce n'est pas un problème vécu. Le Superviseur la bascule en information.

```lib/agent/graph.ts
const procedural = /(comment (déposer|faire|créer))/i.test(state.query);
if (procedural && intent === "complaint") {
  return { ...rules, intent: "info", ...lexical, ...reset };
}
```

### Étape 7 : le routage

La fonction `route` est volontairement courte. Elle traduit une intention en destination.

```lib/agent/graph.ts
function route(state: AgentStateType) {
  if (state.intent === "complaint") return "complaint";
  if (state.intent === "support") return "support";
  if (state.intent === "conversation") return "conversation";
  return "knowledge";
}
```

Une intention inconnue part vers Knowledge. C'est le comportement le plus sûr : l'agent documentaire pourra répondre ou refuser explicitement.

### Étape 8 : l'assemblage du graphe

Le graphe déclare six nœuds et une seule arête conditionnelle. Tous les chemins se terminent par `END`, sauf la réclamation qui passe par `hitl`.

```lib/agent/graph.ts
return new StateGraph(AgentState)
  .addNode("supervisor", supervisor)
  .addNode("knowledge", knowledge)
  .addNode("complaint", complaint)
  .addNode("hitl", hitl)
  .addNode("support", support)
  .addNode("conversation", conversation)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", route, {
    knowledge: "knowledge",
    complaint: "complaint",
    support: "support",
    conversation: "conversation",
  })
  .addEdge("knowledge", END)
  .addEdge("support", END)
  .addEdge("conversation", END)
  .addEdge("complaint", "hitl")
  .addEdge("hitl", END)
  .compile({ checkpointer });
```

Le `checkpointer` est un `PostgresSaver`. Chaque étape est sauvegardée. C'est ce qui rend la suspension et la reprise possibles.

## Exemple concret

Message : « Le tram avait 20 minutes de retard hier sur la ligne 1. »

1. La règle lexicale voit `retard`, donc `complaint`.
2. Le thème devient `ponctualité`.
3. La priorité reste `P3`, car il n'y a ni agression ni litige.
4. Le sentiment devient `negative`.
5. `route` renvoie `complaint`.
6. L'agent Réclamation prend le relais et crée le dossier.

Message : « Où est mon dossier CM-2026-000176 ? »

1. La règle voit le format `CM-2026-`.
2. L'intention devient `support`.
3. `route` renvoie `support`.
4. L'agent Support interroge la base et répond avec le statut.

## Les garde-fous

1. Le modèle ne reçoit jamais la base de données, seulement le message.
2. La sortie est validée champ par champ, avec un repli lexical.
3. Le JSON est strict, la température est de 0,1 et le délai maximal est de 8 secondes.
4. Le bouton Réclamation force l'intention sans dépendre du modèle.
5. Une question de procédure ne crée jamais de dossier.
6. Le Superviseur ne modifie pas la base. Il classe et il route.

## À retenir

Le Superviseur est la porte d'entrée du graphe. Il combine des règles rapides, un modèle qui affine, et une validation stricte. Son résultat n'est pas une réponse, mais une décision de routage.

Si le modèle se trompe ou tombe, le système continue avec les règles. Si l'intention reste inconnue, Knowledge répond ou refuse proprement.

## Questions possibles

**Pourquoi un agent séparé pour le routage ?** Parce que la classification est testable seule et que chaque agent métier reste concentré sur une seule responsabilité.

**Que se passe-t-il si le modèle renvoie un thème invalide ?** `normalizeClassification` garde le thème calculé par les règles lexicales.

**Pourquoi un thread différent à chaque message ?** Pour qu'un dossier en attente de validation humaine ne bloque pas la conversation suivante. La reprise du dossier utilise le `thread_id` stocké sur le ticket.

## Checklist de présentation

- Je sais expliquer le rôle du Superviseur en une phrase.
- Je sais ouvrir `graph.ts` et montrer la fonction `route`.
- Je sais décrire le trajet d'un message sans lire mes notes.
- Je sais citer un garde-fou et expliquer pourquoi il existe.
- Je sais répondre à la question : « que se passe-t-il si le modèle se trompe ? »
