## En 30 secondes

L'Agent Succès client est l'agent proactif. Il n'attend pas qu'un usager écrive. Il pousse une alerte dans le chat ou prépare une relance d'abonnement.

Il gère trois familles de messages : perturbation sur une ligne, information personnalisée, et renouvellement d'abonnement. Chaque message est traduit en français, arabe et anglais.

> À retenir : Succès client parle avant la demande. Il ne répond pas aux questions, il les anticipe.

## Ce que l'agent n'est pas

Le panneau « Voix du client » n'est pas un agent. C'est un tableau de bord qui agrège les dossiers, les thèmes, les lignes, les sentiments et la satisfaction. L'agent Succès client produit les signaux. La VoC les analyse après coup.

## Où vit le code

| Fichier | Rôle |
|---|---|
| `lib/agent/signals.ts` | Création, ciblage, livraison, lecture et masquage des signaux |
| `lib/agent/scheduler.ts` | Relance automatique au démarrage puis toutes les 24 heures |
| `instrumentation.ts` | Démarre le planificateur avec le serveur Next.js |
| `lib/agent/subscriptions.ts` | Plans, dates d'échéance et jours restants |
| `app/api/signals/route.ts` | API admin et usager |
| `app/api/signals/[id]/read/route.ts` | Marque un signal comme lu |
| `app/api/signals/[id]/dismiss/route.ts` | Masque un signal |
| `components/chat/ChatWidget.tsx` | Polling, affichage, lecture et masquage |
| `components/admin/ProactivityPanel.tsx` | Composeur et suivi des diffusions |

## Les deux déclencheurs

| Déclencheur | Qui | Quand |
|---|---|---|
| Perturbation ou information | Admin | Publication manuelle depuis la console |
| Renouvellement d'abonnement | Planificateur | Au démarrage, puis toutes les 24 heures |

La relance d'abonnement n'a plus de bouton manuel. L'API refuse explicitement une relance manuelle avec le code `renewal_automated`.

## Le trajet d'une alerte

1. Un admin choisit une ligne, une sévérité et un texte en trois langues.
2. `POST /api/signals` vérifie la session admin et la validité du payload.
3. `createSignal` insère le signal avec une date d'expiration.
4. Le chat interroge `GET /api/signals` toutes les 12 secondes.
5. `listSignals` filtre selon l'audience, la date et les livraisons déjà faites.
6. Le chat ajoute une carte d'alerte dans la conversation.
7. À l'ouverture, le chat marque le signal comme lu.
8. Le bouton « Masquer » enregistre le masquage.
9. La console affiche les compteurs de livraison, lecture et masquage.

## Le code, étape par étape

### Étape 1 : construire un message dans les trois langues

Un signal contient toujours un titre et un corps en français, arabe et anglais. Pour une perturbation, le texte est préconstruit. Pour un message libre, l'admin saisit les trois versions.

```lib/agent/signals.ts
if (kind === "disruption") {
  return {
    fr: {
      title: `Perturbation ${line}`,
      body: "Un incident à Casa Port interrompt la circulation...",
    },
    ar: {
      title: "Perturbation " + line,
      body: "Un incident interrompt la circulation...",
    },
    en: {
      title: `${line} disruption`,
      body: "An incident at Casa Port stops service...",
    },
  };
}
```

Le chat choisit la langue de l'usager, avec le français comme repli.

### Étape 2 : créer le signal

`createSignal` calcule la sévérité, la durée de vie et l'audience. Une perturbation expire après deux heures. Les autres signaux expirent après vingt-quatre heures.

```lib/agent/signals.ts
const userId = options.userId ?? null;
const payload = options.payload ?? buildPayload(kind, line, options.daysLeft);
const severity =
  options.severity ?? (kind === "disruption" ? "warning" : "info");
const hours = kind === "disruption" ? 2 : 24;

const { rows } = await pool.query<SignalRow>(
  `INSERT INTO signals
     (kind, line, user_id, severity, created_by, created_by_email, payload, expires_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb,
     now() + ($8::int * interval '1 hour'))
   RETURNING *`,
  [kind, kind === "renewal" ? null : line, userId, severity,
   options.createdBy?.id ?? null, options.createdBy?.email ?? "",
   JSON.stringify(payload), hours]
);
```

Une perturbation peut être globale ou limitée à une ligne. Une relance est toujours liée à un usager.

### Étape 3 : trouver les abonnements à relancer

La requête de renouvellement cherche les abonnements actifs qui expirent dans les sept jours. Elle exclut les usagers qui ont déjà reçu une relance aujourd'hui.

```lib/agent/signals.ts
const { rows } = await pool.query<{ user_id: number; ends_at: Date }>(
  `SELECT DISTINCT ON (s.user_id) s.user_id, s.ends_at
   FROM subscriptions s
   WHERE s.status = 'active'
     AND s.ends_at > now()
     AND s.ends_at <= now() + interval '7 days'
     AND NOT EXISTS (
       SELECT 1 FROM signals g
       WHERE g.kind = 'renewal'
         AND g.user_id = s.user_id
         AND g.created_at >= date_trunc('day', now())
     )
   ORDER BY s.user_id, s.ends_at DESC`
);
```

`DISTINCT ON` garde un seul abonnement par usager, le plus proche de l'échéance.

### Étape 4 : remplacer l'ancienne relance

Si une relance active existe déjà pour ces usagers, elle est expirée avant la création de la nouvelle. Cela évite d'empiler deux messages identiques.

```lib/agent/signals.ts
if (rows.length > 0) {
  await pool.query(
    `UPDATE signals
     SET expires_at = now() - interval '1 minute'
     WHERE kind = 'renewal'
       AND expires_at > now()
       AND user_id = ANY($1::int[])`,
    [rows.map((row) => row.user_id)]
  );
}

for (const row of rows) {
  const daysLeft = Math.max(
    1,
    Math.ceil((new Date(row.ends_at).getTime() - Date.now()) / 86_400_000)
  );
  signals.push(await createSignal("renewal", "ligne 1", {
    userId: row.user_id,
    daysLeft,
  }));
}
```

Le texte contient le nombre de jours restants. La relance est ciblée sur un seul compte.

### Étape 5 : le planificateur automatique

Le planificateur est lancé par `instrumentation.ts` au démarrage du serveur. Il attend cinq secondes, puis exécute la relance. Il réessaie toutes les quinze minutes si la base n'est pas prête, puis une fois par jour.

```lib/agent/scheduler.ts
export function startRenewalScheduler() {
  if (process.env.RENEWAL_AUTO === "false") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (globalScheduler.__casamoveRenewalScheduler) return;
  globalScheduler.__casamoveRenewalScheduler = true;

  const run = async () => {
    try {
      const signals = await createRenewalSignals();
      if (signals.length > 0) {
        console.info(`[renewals] ${signals.length} relance(s) publiée(s)`);
      }
    } catch (error) {
      console.warn(`[renewals] ${error.message}`);
    }
  };

  let firstRunDone = false;
  setTimeout(run, 5_000);
  setInterval(() => { if (!firstRunDone) void run(); }, 15 * 60 * 1000);
  setInterval(run, 24 * 60 * 60 * 1000);
}
```

Le garde `NEXT_PHASE` évite de lancer le planificateur pendant le build. `RENEWAL_AUTO=false` le coupe en test.

### Étape 6 : filtrer ce que chaque usager peut voir

`listSignals` applique quatre filtres : date d'expiration, audience, livraisons déjà effectuées et plafond quotidien.

```lib/agent/signals.ts
WHERE s.expires_at > now()
  AND ($2::boolean OR s.user_id IS NULL OR s.user_id = $3)
  AND (
    $2::boolean
    OR ($3::int IS NULL AND $4::text IS NULL)
    OR NOT EXISTS (
      SELECT 1 FROM signal_deliveries d
      WHERE d.signal_id = s.id
        AND (($3::int IS NOT NULL AND d.user_id = $3)
          OR ($4::text IS NOT NULL AND d.session_id = $4))
    )
  )
```

Un signal global est visible par tout le monde. Un signal de renouvellement n'est visible que par son usager. Une alerte déjà livrée n'est pas renvoyée.

### Étape 7 : plafonner les relances et les informations

Les perturbations ne sont pas plafonnées. Les autres signaux sont limités à une livraison par usager ou session et par jour.

```lib/agent/signals.ts
AND (
  $2::boolean
  OR ($3::int IS NULL AND $4::text IS NULL)
  OR s.kind = 'disruption'
  OR NOT EXISTS (
    SELECT 1 FROM signal_deliveries d
    WHERE d.delivered_at >= date_trunc('day', now())
      AND (($3::int IS NOT NULL AND d.user_id = $3)
        OR ($4::text IS NOT NULL AND d.session_id = $4))
  )
)
```

Le plafond évite de transformer le chat en flux de notifications.

### Étape 8 : enregistrer la livraison, la lecture et le masquage

Chaque diffusion est tracée dans `signal_deliveries`. La lecture et le masquage mettent à jour la même ligne.

```lib/agent/signals.ts
await pool.query(
  `INSERT INTO signal_deliveries (signal_id, user_id, session_id)
   VALUES ($1, $2, $3)
   ON CONFLICT DO NOTHING`,
  [signal.id, userId, sessionId]
);

await pool.query(
  `UPDATE signal_deliveries
   SET read_at = COALESCE(read_at, now())
   WHERE signal_id = $1 AND user_id = $2`,
  [signalId, userId]
);

await pool.query(
  `UPDATE signal_deliveries
   SET dismissed_at = now(), read_at = COALESCE(read_at, now())
   WHERE signal_id = $1 AND user_id = $2`,
  [signalId, userId]
);
```

Les index uniques empêchent les doublons de livraison pour un même usager ou une même session.

### Étape 9 : afficher l'alerte dans le chat

Le chat interroge l'API toutes les douze secondes. Il garde un identifiant `since` pour ne demander que les nouveaux signaux. Il mémorise aussi les identifiants déjà affichés.

```components/chat/ChatWidget.tsx
const params = new URLSearchParams({ sessionId: sessionRef.current });
if (sinceRef.current) params.set("since", sinceRef.current);

const response = await fetch(`/api/signals?${params.toString()}`, {
  cache: "no-store",
});

const data = await response.json();
for (const signal of data.signals ?? []) {
  if (seenRef.current.has(signal.id)) continue;
  seenRef.current.add(signal.id);
  const content = signal.payload[locale] ?? signal.payload.fr;
  setMessages((list) => [...list, { role: "bot", alert: content }]);
}
```

Le polling fonctionne même si le chat est fermé. L'alerte apparaît à l'ouverture.

### Étape 10 : le suivi dans la console

`ProactivityPanel` affiche les signaux avec leur audience et leurs compteurs. Il interroge l'API toutes les dix secondes pour voir les lectures et les masquages arriver.

```components/admin/ProactivityPanel.tsx
const response = await fetch("/api/signals?scope=all", { cache: "no-store" });
const data = await response.json();
setSignals(data.signals ?? []);

const timer = window.setInterval(load, 10_000);
```

La carte de renouvellement affiche aussi la date de la dernière relance automatique.

## Exemple concret : perturbation

1. L'admin choisit la ligne 2, la sévérité `warning`, puis publie.
2. Le signal est stocké avec une expiration de deux heures.
3. Le chat ouvert reçoit l'alerte au prochain polling, sous douze secondes.
4. L'usager lit l'alerte, puis clique sur « Masquer ».
5. La console affiche `1 livré`, `1 lu`, `1 masqué`.

## Exemple concret : renouvellement

1. L'usager `usager@casamove.ma` a un abonnement qui expire dans cinq jours.
2. Le planificateur démarre et appelle `createRenewalSignals`.
3. La requête trouve cet abonnement et crée une relance ciblée.
4. Le chat de cet usager affiche « Abonnement à renouveler ».
5. Le compte `mensuel@casamove.ma`, qui expire dans vingt jours, ne reçoit rien.

## Les garde-fous

1. Seul un admin peut publier une perturbation ou une information.
2. Une relance de renouvellement ne peut pas être publiée manuellement.
3. Une relance maximum par usager et par jour.
4. Une information maximum par usager ou session et par jour.
5. Les perturbations ne sont pas plafonnées.
6. Une perturbation expire après deux heures, les autres signaux après vingt-quatre heures.
7. Les livraisons sont uniques par signal et par audience.
8. Le chat ne renvoie pas une alerte déjà livrée.
9. Aucun e-mail, SMS ou push : tout passe par le chat et la console.

## À retenir

Succès client est un agent de diffusion. Il cible une ligne ou un usager, traduit le message, stocke le signal et suit ce qui se passe.

La relance d'abonnement est automatique, mais contrôlée : une par jour, ciblée sur les abonnements à sept jours, et jamais manuelle.

## Questions possibles

**Pourquoi un planificateur dans le processus Next.js ?** Pour éviter un service externe et un cron à installer. Le compromis est qu'il tourne seulement quand le serveur est allumé.

**Comment évitez-vous le spam ?** Les perturbations sont libres, mais les relances et informations sont limitées à une par usager ou session et par jour.

**Pourquoi la VoC n'est-elle pas un agent ?** Parce qu'elle ne décide pas et ne parle pas à l'usager. Elle agrège les données produites par les autres agents.

## Checklist de présentation

- Je sais expliquer le rôle de Succès client en une phrase.
- Je sais ouvrir `signals.ts` et montrer `createRenewalSignals`.
- Je sais distinguer une perturbation d'une relance d'abonnement.
- Je sais expliquer le plafond quotidien et le ciblage.
- Je sais répondre à la question : « que se passe-t-il si la base est indisponible au démarrage ? »
