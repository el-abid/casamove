## En 30 secondes

L'Agent Réclamation transforme un problème vécu en dossier suivi. Il vérifie que le message contient assez de détails, crée un numéro, calcule une échéance, enregistre le message et prépare un brouillon de réponse.

Ensuite, il s'arrête. Un agent humain doit relire le brouillon et décider de le publier ou de rejeter le dossier. C'est le point HITL : Human In The Loop.

> À retenir : la réclamation n'est jamais publiée automatiquement. Un humain valide.

## Où vit le code

| Fichier | Rôle |
|---|---|
| `lib/agent/graph.ts` | Nœuds `complaint` et `hitl`, appel à `interrupt()` |
| `lib/agent/tickets.ts` | Création, statuts, brouillon, messages, événements, CSAT |
| `lib/agent/classification.ts` | Thème, priorité, sentiment et ligne |
| `app/api/tickets/[id]/decision/route.ts` | Reprise du graphe après décision admin |
| `app/api/tickets/[id]/resolve/route.ts` | Clôture après accord de l'usager |
| `app/api/tickets/[id]/csat/route.ts` | Note de satisfaction 1 à 5 |
| `components/admin/` | File d'attente, fiche dossier, conversation support |

## La machine à états

| Statut | Signification |
|---|---|
| `pending` | Dossier créé, brouillon en attente de validation humaine |
| `in_progress` | Réponse publiée, discussion ouverte avec l'usager |
| `resolved` | Dossier clôturé avec l'accord de l'usager |
| `rejected` | Dossier rejeté et escaladé au superviseur |

Le passage `pending` vers `in_progress` se fait par la décision d'un admin. Le passage vers `resolved` se fait après un accord explicite. Aucun statut ne revient en arrière.

## Le trajet d'une réclamation

1. L'usager décrit un problème.
2. Le Superviseur route vers `complaint`.
3. L'agent vérifie les détails. S'il en manque, il demande la ligne, la date ou le lieu.
4. Le thème, la priorité, le sentiment et la ligne sont classés.
5. `createTicket` insère le dossier et calcule l'échéance SLA.
6. Le brouillon est généré, puis sauvegardé.
7. Le graphe appelle `interrupt()` et se suspend.
8. La console admin affiche le dossier dans la file.
9. L'admin relit, modifie éventuellement le brouillon, puis publie ou rejette.
10. Le graphe reprend sur le même `thread_id`.
11. Si la réponse est publiée, l'usager peut discuter avec l'agent.
12. Après accord, l'admin clôture. L'usager reçoit une demande de satisfaction.

## Le code, étape par étape

### Étape 1 : vérifier que le message est assez précis

Une réclamation sans ligne, sans date et sans lieu n'est pas exploitable. La fonction `hasComplaintDetails` cherche un marqueur concret ou un message suffisamment long.

```lib/agent/graph.ts
function hasComplaintDetails(query: string): boolean {
  const q = normalize(query);
  const marks =
    /(ligne|station|arret|hier|aujourd|matin|soir|\d{1,2}\s*h|\d{1,2}\/\d{1,2})/.test(q);
  return marks || q.split(" ").length >= 12;
}

async function complaint(state: AgentStateType) {
  if (!hasComplaintDetails(state.query)) {
    return { reply: texts.intake[state.locale], sources: [] };
  }
```

Si les détails manquent, aucun dossier n'est créé. L'agent demande simplement les éléments manquants.

### Étape 2 : créer le dossier

`createTicket` insère une ligne dans la table `tickets`. Le numéro est construit avec l'année et une séquence Postgres. Le statut de départ est `pending`.

```lib/agent/tickets.ts
const line = input.line ?? lineOfQuery(input.query);

const { rows } = await pool.query<TicketRow>(
  `INSERT INTO tickets
     (number, priority, theme, sentiment, line, locale, thread_id,
      user_query, draft, sla_deadline, user_id)
   VALUES (
     format('CM-%s-%s', $1::int,
       lpad(nextval('ticket_number_seq')::text, 6, '0')),
     $2, $3, $4, $5, $6, $7, $8, $9,
     now() + ($10::int * interval '1 hour'),
     $11
   )
   RETURNING *`,
  [
    new Date().getFullYear(),
    input.priority,
    input.theme,
    input.sentiment,
    line,
    input.locale,
    input.threadId,
    input.query,
    input.draft,
    SLA_HOURS[input.priority],
    input.userId ?? null,
  ]
);
```

Le `thread_id` stocke le lien entre le dossier et le checkpoint LangGraph. C'est la clé de la reprise.

### Étape 3 : calculer l'échéance SLA

Le SLA dépend de la priorité. Une agression doit être traitée en quatre heures. Une information peut attendre soixante-douze heures.

```lib/agent/tickets.ts
export const SLA_HOURS: Record<Priority, number> = {
  P1: 4,
  P2: 24,
  P3: 72,
};
```

La date limite est écrite dans `sla_deadline`. La console affiche le temps restant et signale les dossiers à risque.

### Étape 4 : éviter les doublons

Si un usager connecté envoie deux fois le même message en moins de dix minutes, le second ne crée pas un nouveau dossier. `createTicket` renvoie le dossier existant.

```lib/agent/tickets.ts
if (input.userId) {
  const { rows: recent } = await pool.query<TicketRow>(
    `SELECT * FROM tickets
     WHERE user_id = $1
       AND status = 'pending'
       AND created_at > now() - interval '10 minutes'
       AND lower(trim(user_query)) = lower(trim($2))
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.userId, input.query]
  );

  if (recent[0]) return mapRow(recent[0]);
}
```

Cette règle évite les doubles clics et les rechargements de page.

### Étape 5 : enregistrer le message et l'événement

Un dossier seul ne suffit pas. Il faut garder la demande d'origine, un message système et un événement de journal.

```lib/agent/tickets.ts
await recordTicketEvent({
  ticketNumber: ticket.number,
  event: "created",
  detail: `Priorité ${ticket.priority} · ${ticket.theme}`,
});

await addTicketMessage({
  ticketNumber: ticket.number,
  role: "user",
  body: input.query,
});

await addTicketMessage({
  ticketNumber: ticket.number,
  role: "system",
  body: `Réclamation enregistrée. Priorité ${ticket.priority}, thème ${ticket.theme}.`,
});
```

Le journal est la trace d'audit. La conversation est ce que l'usager et l'agent voient.

### Étape 6 : générer un brouillon

Le brouillon de secours est construit avec le message et le numéro. Si le LLM est activé, il produit un JSON avec une confirmation `ack` et un brouillon `draft`.

```lib/agent/graph.ts
const generated = await chatJSON<{ ack?: string; draft?: string }>(
  [
    { role: "system", content: `Tu es l'agent Réclamation.
Réponds uniquement par un JSON valide :
{"ack":"...","draft":"..."}
ack : confirmation courte avec numéro, priorité, échéance et validation humaine.
draft : réponse proposée, trois phrases, ton empathique, sans promesse de remboursement.` },
    { role: "user", content: `Dossier : ${ticket.number}\nPriorité : ${priority}
Échéance : ${deadline}\nMessage : ${state.query}` },
  ],
  { maxTokens: 500, temperature: 0.3, timeoutMs: 12_000 }
);

const updated = await setTicketDraft(ticket.number, draftText);
```

Le brouillon est sauvegardé avant la suspension. L'admin le retrouve donc dans la fiche, même après un redémarrage du serveur.

### Étape 7 : suspendre avec `interrupt()`

C'est le cœur du HITL. Le graphe s'arrête et attend une décision. Le payload contient le dossier et le brouillon.

```lib/agent/graph.ts
async function hitl(state: AgentStateType) {
  const ticket = state.ticket;
  if (!ticket) return {};

  const decision = interrupt<HitlPayload, HitlDecision>({
    ticket,
    draft: ticket.draft,
  });

  if (decision.action === "approve") {
    await setTicketStatus(ticket.number, "in_progress");
    return { decision, reply: texts.approved[state.locale](ticket.number) };
  }

  await setTicketStatus(ticket.number, "rejected");
  return { decision, reply: texts.rejected[state.locale](ticket.number) };
}
```

`interrupt()` ne bloque pas le serveur. LangGraph sauvegarde l'état dans Postgres et rend la main. La conversation peut continuer.

### Étape 8 : reprendre depuis la console

L'admin appelle `POST /api/tickets/{id}/decision`. La route vérifie qu'il est admin, que le dossier existe et qu'il est encore `pending`.

```app/api/tickets/[id]/decision/route.ts
const user = await getCurrentUser();
if (!user || !isAdmin(user)) {
  return Response.json({ error: "forbidden" }, { status: 403 });
}

const ticket = await getTicket(id);
if (!ticket) {
  return Response.json({ error: "ticket_not_found" }, { status: 404 });
}

if (ticket.status !== "pending") {
  return Response.json({ error: "ticket_already_decided" }, { status: 409 });
}
```

Le statut `pending` est la garde contre une double décision.

### Étape 9 : relancer le graphe sur le même thread

La reprise utilise `Command({ resume })` et le `thread_id` du ticket. C'est ce qui permet de reprendre exactement au nœud `hitl`.

```app/api/tickets/[id]/decision/route.ts
const graph = await getGraph();

await graph.invoke(
  new Command({ resume: { action, comment } }),
  { configurable: { thread_id: ticket.threadId } }
);
```

Après la reprise, la route enregistre la décision, l'événement et, si la réponse est approuvée, le message de l'agent.

### Étape 10 : publier la réponse

Si l'action est `approve`, le brouillon devient un message de rôle `agent`. L'usager le voit dans le chat et dans son compte.

```app/api/tickets/[id]/decision/route.ts
if (action === "approve") {
  const current = await getTicket(id);
  if (current) {
    await addTicketMessage({
      ticketNumber: id,
      role: "agent",
      body: current.draft,
      authorEmail: user.email,
    });
  }
}
```

La réponse n'est pas envoyée par e-mail. Elle est publiée dans le dossier et le chat.

### Étape 11 : discuter, puis clôturer

Après publication, le dossier passe en `in_progress`. L'agent et l'usager échangent des messages. Quand l'usager confirme que tout est réglé, l'admin appelle `resolve`.

```app/api/tickets/[id]/resolve/route.ts
if (ticket.status !== "in_progress") {
  return Response.json({ error: "ticket_not_in_progress" }, { status: 409 });
}

await resolveTicket(id);

await addTicketMessage({
  ticketNumber: id,
  role: "system",
  body: "Dossier clôturé avec l'accord de l'usager.",
  authorEmail: user.email,
});
```

La clôture est une action distincte de la publication. Elle matérialise l'accord de l'usager.

### Étape 12 : demander la satisfaction

Une fois le dossier `resolved`, l'usager peut noter de 1 à 5. La route vérifie que la note est valide, que le dossier est clôturé et qu'aucune note n'existe déjà.

```app/api/tickets/[id]/csat/route.ts
if (!Number.isInteger(score) || score < 1 || score > 5) {
  return Response.json({ error: "invalid_score" }, { status: 400 });
}

if (ticket.status !== "resolved") {
  return Response.json({ error: "ticket_not_resolved" }, { status: 409 });
}

if (ticket.csatScore !== null) {
  return Response.json({ error: "csat_already_submitted" }, { status: 409 });
}

const updated = await setTicketCsat(id, score);
```

La note alimente ensuite la Voix du client.

## Exemple concret

Message : « Je veux signaler une insulte d'un agent à la station Abdelmoumen sur la ligne 2 ce matin. »

1. Le Superviseur route vers Réclamation.
2. `hasComplaintDetails` voit la station, la ligne et le moment.
3. Le thème devient `sécurité`.
4. La priorité devient `P2`, car une insulte est un comportement grave.
5. Le sentiment devient `negative`.
6. La ligne extraite est `ligne 2`.
7. `createTicket` crée `CM-2026-000xxx` avec un SLA de 24 heures.
8. Le brouillon est généré et sauvegardé.
9. Le graphe s'arrête sur `hitl`.
10. L'admin publie le brouillon. Le dossier passe en `in_progress`.
11. Après accord, le dossier passe en `resolved` et la note CSAT est demandée.

## Les garde-fous

1. Pas de dossier sans détails concrets.
2. Dédoublonnage sur dix minutes pour un même usager.
3. SLA calculé selon la priorité.
4. Publication impossible sans décision admin.
5. Seul un admin peut appeler la route de décision et la route de clôture.
6. Une double décision est refusée par le statut `pending`.
7. Une clôture sans accord n'est pas prévue par le flux.
8. Une seule note CSAT par dossier.
9. Toutes les actions sont journalisées.

## Les mots à connaître

**HITL** : Human In The Loop. Un humain valide une étape automatisée.

**Interrupt** : primitive LangGraph qui suspend le graphe et sauvegarde son état.

**Checkpoint** : sauvegarde de l'état du graphe dans Postgres.

**Thread** : identifiant de la conversation persistée. La reprise utilise le même thread.

**SLA** : délai maximal de traitement. P1 = 4 h, P2 = 24 h, P3 = 72 h.

## À retenir

L'Agent Réclamation crée un dossier traçable, calcule une échéance et prépare une réponse. Il ne publie jamais seul. La validation humaine est le centre du cycle.

Le graphe peut être suspendu pendant des heures et reprendre au même nœud grâce au checkpoint Postgres.

## Questions possibles

**Pourquoi ne pas publier automatiquement ?** Parce qu'une réponse à une réclamation peut engager le réseau. La validation humaine limite le risque et laisse une trace.

**Que se passe-t-il si le serveur redémarre pendant l'attente ?** Le checkpoint est dans Postgres. La console peut reprendre le dossier après redémarrage.

**Pourquoi une clôture séparée de la publication ?** Parce que publier une réponse ne signifie pas que l'usager est satisfait. La clôture matérialise son accord.

## Checklist de présentation

- Je sais expliquer le rôle de Réclamation en une phrase.
- Je sais ouvrir `tickets.ts` et montrer `createTicket`.
- Je sais décrire le cycle `pending`, `in_progress`, `resolved`.
- Je sais expliquer le rôle de `interrupt()` et du checkpoint.
- Je sais répondre à la question : « que se passe-t-il si le serveur redémarre pendant l'attente ? »
