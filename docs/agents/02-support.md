## En 30 secondes

L'Agent Support répond aux demandes qui demandent une donnée précise : le statut d'un dossier, la liste de vos dossiers, votre abonnement ou une perturbation sur une ligne.

Il ne répond pas avec le corpus documentaire. Il exécute un outil, lit le résultat, puis formule une réponse courte. Si l'usager n'est pas connecté, il demande la connexion au lieu d'inventer.

> À retenir : Support ne devine pas. Il planifie un outil, l'exécute, puis raconte le résultat.

## Où vit le code

| Fichier | Rôle |
|---|---|
| `lib/agent/support.ts` | Planifie l'outil (`planSupport`) et l'exécute (`executeSupport`) |
| `lib/agent/graph.ts` | Nœud `support`, appelé quand l'intention vaut `support` |
| `lib/agent/tickets.ts` | `getTicket`, `listTicketsByUser`, `formatDeadline` |
| `lib/agent/signals.ts` | `listSignals` pour les perturbations actives |
| `lib/agent/subscriptions.ts` | `getSubscription`, `describeSubscription` |
| `app/api/chat/route.ts` | Transmet l'identité de l'usager au graphe |

## Les cinq outils

| Outil | Question typique | Donnée lue |
|---|---|---|
| `ticket_status` | « Où est mon dossier CM-2026-000176 ? » | Table `tickets` |
| `my_tickets` | « Mes dossiers », « mon suivi » | Dossiers de l'usager |
| `subscription_status` | « Mon abonnement expire quand ? » | Table `subscriptions` |
| `line_status` | « La ligne 2 est perturbée ? » | Table `signals` |
| `none` | Question hors périmètre | Aucune |

## Le trajet d'une demande

1. Le Superviseur détecte l'intention `support`.
2. Le nœud `support` appelle `planSupport(query, hasUser)`.
3. Le plan choisit un outil et ses arguments.
4. `executeSupport(plan, userId, locale)` exécute l'outil.
5. Le résultat contient une réponse de secours et des données structurées.
6. Si le LLM est activé et qu'aucune donnée personnelle n'est sensible, il reformule le résultat.
7. La route SSE envoie la réponse. Si un dossier est concerné, elle envoie aussi une carte dossier.

## Le code, étape par étape

### Étape 1 : définir les outils

Le type `SupportTool` limite les actions possibles. Un outil inconnu ne peut pas être exécuté.

```lib/agent/support.ts
export type SupportTool =
  | "ticket_status"
  | "my_tickets"
  | "line_status"
  | "subscription_status"
  | "none";

export type SupportPlan = {
  tool: SupportTool;
  args: { number?: string; line?: string };
};
```

Cette liste est le contrat entre le planificateur et l'exécuteur. Elle sert aussi de garde-fou face au modèle.

### Étape 2 : planifier avec des règles

La première planification est déterministe. Un numéro de dossier déclenche `ticket_status`. Les mots « mes dossiers » déclenchent `my_tickets`. Les mots « abonnement » ou « expire » déclenchent `subscription_status`. Le mot « perturbation » déclenche `line_status`.

```lib/agent/support.ts
const number = query.toUpperCase().match(/CM-\d{4}-\d{6}/)?.[0];

const rules: SupportPlan = number
  ? { tool: "ticket_status", args: { number } }
  : isSubscriptionQuestion(query)
    ? { tool: "subscription_status", args: {} }
    : /(mes dossiers|mon dossier|statut|suivi|avancement)/i.test(query)
      ? { tool: "my_tickets", args: {} }
      : /(perturb|trafic|disruption|traffic)/i.test(query)
        ? { tool: "line_status", args: { line: detectLine(query) } }
        : { tool: "none", args: {} };
```

Si le LLM est désactivé, ce plan est utilisé directement. C'est le mode de secours.

### Étape 3 : laisser le modèle choisir, sans lui faire confiance

Si le LLM est activé, `chatJSON` choisit un outil avec des arguments. Le résultat est vérifié : l'outil doit appartenir à la liste, et un numéro de dossier doit respecter le format.

```lib/agent/support.ts
const result = await chatJSON<{
  tool?: string;
  args?: { number?: string; line?: string };
}>(
  [
    { role: "system", content: `Choisis un outil pour répondre.
Outils : ticket_status, my_tickets, line_status, subscription_status, none.
Réponds uniquement par un JSON valide :
{"tool":"ticket_status|my_tickets|line_status|subscription_status|none","args":{}}` },
    { role: "user", content: query },
  ],
  { maxTokens: 120, temperature: 0.1, timeoutMs: 8_000 }
);

const tool = result?.tool;
if (!["ticket_status", "my_tickets", "line_status",
     "subscription_status", "none"].includes(tool ?? "")) {
  return rules;
}
```

Si le modèle répond `none` alors que les règles avaient trouvé un outil, les règles gagnent. C'est volontaire : le modèle ne doit pas annuler une demande évidente.

### Étape 4 : chercher un dossier et vérifier le propriétaire

`executeSupport` commence par le cas le plus fréquent : un numéro de dossier. La fonction vérifie que le dossier existe et qu'il appartient à l'usager connecté. Un dossier sans propriétaire peut être consulté par son numéro.

```lib/agent/support.ts
if (plan.tool === "ticket_status" && plan.args.number) {
  const ticket = await getTicket(plan.args.number);

  if (!ticket || (ticket.userId !== null && ticket.userId !== userId)) {
    return {
      data: { found: false, number: plan.args.number },
      fallback: TEXTS.noTicket[locale],
    };
  }

  const deadline = formatDeadline(ticket.slaDeadline, locale);
  const response =
    ticket.status === "in_progress" || ticket.status === "resolved"
      ? ticket.draft
      : null;
```

La réponse publiée n'est renvoyée que si le dossier est en cours ou clôturé. Un dossier encore en attente de validation ne divulgue pas le brouillon.

### Étape 5 : construire une réponse lisible

Le résultat contient toujours un texte de secours, même si le LLM est coupé. Ce texte est construit avec le statut traduit, la priorité et l'échéance.

```lib/agent/support.ts
const summary =
  locale === "fr"
    ? `Dossier ${ticket.number} : ${STATUS_LABEL[locale][ticket.status]}, ` +
      `priorité ${ticket.priority}, échéance ${deadline}.`
    : /* versions arabe et anglaise */ "";

return {
  data: {
    found: true,
    number: ticket.number,
    status: STATUS_LABEL[locale][ticket.status],
    priority: ticket.priority,
    deadline,
    response,
  },
  fallback: `${summary}${published}`,
  ticket,
};
```

Les données structurées servent au modèle. Le texte de secours sert quand le modèle est indisponible.

### Étape 6 : les données personnelles

`my_tickets` et `subscription_status` exigent un usager connecté. Sans session, la réponse demande la connexion.

```lib/agent/support.ts
if (plan.tool === "my_tickets") {
  if (!userId) {
    return {
      data: { needsLogin: true },
      fallback: TEXTS.needLogin[locale],
      needsLogin: true,
    };
  }

  const tickets = (await listTicketsByUser(userId)).slice(0, 5);
  const data = tickets.map((ticket) => ({
    number: ticket.number,
    status: STATUS_LABEL[locale][ticket.status],
  }));

  return {
    data: { count: tickets.length, tickets: data },
    fallback: /* liste courte */ "",
  };
}
```

La limite de cinq dossiers garde la réponse lisible dans le chat.

### Étape 7 : l'abonnement

`getSubscription` lit le dernier abonnement de l'usager. `describeSubscription` calcule le nombre de jours restants, le statut réel et le prix de renouvellement.

```lib/agent/subscriptions.ts
const daysLeft = Math.ceil(
  (new Date(subscription.endsAt).getTime() - Date.now()) / 86_400_000
);

const key =
  subscription.status === "suspended" || subscription.status === "cancelled"
    ? subscription.status
    : daysLeft <= 0
      ? "expired"
      : daysLeft <= 7
        ? "expiring"
        : "active";
```

Le statut affiché n'est pas seulement celui stocké. Un abonnement encore actif mais qui expire dans cinq jours est présenté comme « expire bientôt ».

### Étape 8 : la perturbation de ligne

`line_status` lit les signaux actifs. Il cherche une perturbation globale ou une perturbation qui correspond à la ligne demandée.

```lib/agent/support.ts
const line = plan.args.line ?? "ligne 1";
const signals = await listSignals();
const disruption = signals.find(
  (signal) =>
    signal.kind === "disruption" &&
    (!signal.line || signal.line.toLowerCase().includes(line.replace("ligne ", "")))
);

if (!disruption) {
  return { data: { line, disruption: null }, fallback: noDisruption(locale, line) };
}

const payload = disruption.payload[locale] ?? disruption.payload.fr;
return { data: { line, disruption: payload }, fallback: `${payload.title}. ${payload.body}` };
```

La perturbation est traduite dans la langue de l'usager. Si aucune perturbation n'existe, la réponse le dit clairement.

### Étape 9 : la reformulation par le modèle

Le LLM ne voit que le résultat de l'outil. Il ne peut pas ajouter un fait. Il est aussi bloqué si l'usager doit se connecter ou si une réponse est déjà publiée.

```lib/agent/graph.ts
if (llmEnabled() && !outcome.needsLogin && !published) {
  const generated = await chatCompletion(
    [
      { role: "system", content: `Réponds uniquement à partir du résultat d'outil.
Ne promets rien qui n'est pas dans le résultat. Deux phrases maximum.` },
      { role: "user", content: `Question : ${state.query}\nRésultat : ${JSON.stringify(outcome.data)}` },
    ],
    { maxTokens: 200, temperature: 0.2, timeoutMs: 12_000 }
  );

  if (generated && generated.length >= 5 && generated.length <= 700) {
    reply = generated;
  }
}
```

Le texte de secours reste disponible si le modèle échoue.

## Exemple concret

Message : « Où est mon dossier CM-2026-000176 ? »

1. Le Superviseur voit le format du numéro et route vers Support.
2. `planSupport` choisit `ticket_status` avec `CM-2026-000176`.
3. `getTicket` lit la ligne dans `tickets`.
4. Le propriétaire est vérifié.
5. Le statut `in_progress`, la priorité `P3` et l'échéance sont formatés.
6. La réponse publiée est ajoutée si elle existe.
7. Le chat affiche le texte et la carte du dossier.

Message : « Mon abonnement expire quand ? »

1. `isSubscriptionQuestion` détecte le sujet.
2. `planSupport` choisit `subscription_status`.
3. Sans session, la réponse demande la connexion.
4. Avec session, `getSubscription` lit la base et `describeSubscription` calcule les jours restants.

## Les garde-fous

1. Un dossier privé n'est lisible que par son propriétaire ou un admin.
2. Les données personnelles exigent une session.
3. La liste des dossiers est limitée à cinq.
4. Le modèle ne voit que le JSON de l'outil, jamais la base complète.
5. Le texte de secours existe pour chaque outil.
6. Un outil inconnu retombe sur les règles.

## À retenir

Support est un agent à outils. Il planifie une action, l'exécute et raconte le résultat. La sécurité vient de la vérification du propriétaire et de la limitation des données envoyées au modèle.

Le LLM améliore la formulation. Il ne décide pas de la vérité des données.

## Questions possibles

**Pourquoi ne pas laisser le LLM interroger la base directement ?** Parce qu'il pourrait choisir une mauvaise requête ou divulguer un dossier. Ici, il choisit seulement parmi cinq outils contrôlés.

**Que se passe-t-il si le modèle choisit `none` ?** Si les règles avaient trouvé un outil, les règles sont conservées.

**Pourquoi un texte de secours ?** Pour que le chat réponde même sans réseau, sans clé API ou en cas de panne du modèle.

## Checklist de présentation

- Je sais expliquer le rôle de Support en une phrase.
- Je sais ouvrir `support.ts` et montrer `planSupport`.
- Je sais décrire le trajet d'une demande sans lire mes notes.
- Je sais citer un garde-fou et expliquer pourquoi il existe.
- Je sais répondre à la question : « que se passe-t-il si l'usager n'est pas connecté ? »
