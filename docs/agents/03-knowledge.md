## En 30 secondes

L'Agent Knowledge répond aux questions d'information : horaires, tarifs, correspondances, accessibilité, objets perdus, agences, procédures.

Il ne répond pas de mémoire. Il utilise les 17 fiches du corpus, sélectionne les bonnes fiches, vérifie une preuve textuelle, puis rédige une réponse courte. S'il ne trouve pas, il refuse et propose un dossier.

> À retenir : Knowledge préfère refuser plutôt que d'inventer.

## Où vit le code

| Fichier | Rôle |
|---|---|
| `lib/agent/corpus.ts` | Les 17 fiches, la normalisation et le classement lexical |
| `lib/agent/retrieval.ts` | Routeur documentaire, preuve, retrieval hybride |
| `lib/agent/embeddings.ts` | Embedding de la question et similarité cosinus |
| `lib/agent/embeddings.json` | 51 vecteurs précalculés, 17 fiches × 3 langues |
| `lib/agent/graph.ts` | Nœud `knowledge` et fonction `answerFromDocs` |
| `scripts/build-embeddings.mjs` | Recalcule les vecteurs après une modification du corpus |

## Deux chemins de réponse

| Chemin | Quand | Ce qu'il fait |
|---|---|---|
| Routeur documentaire | LLM activé | Choisit 1 à 3 fiches et cite une phrase exacte |
| Retrieval hybride | LLM coupé, routeur en échec ou routeur sans fiche | Combine score lexical et score dense |

Le routeur est le chemin principal. L'hybride est le filet de sécurité.

## Le trajet d'une question

1. Le Superviseur route l'intention `info` vers Knowledge.
2. Si le LLM est activé, `routeDocuments` reçoit la question et le catalogue des 17 fiches.
3. Le modèle renvoie `answerable`, des identifiants de fiches et une phrase de preuve par fiche.
4. Le code vérifie que chaque identifiant existe et que chaque preuve est bien une sous-chaîne du corps de la fiche.
5. Si une fiche est validée, `answerFromDocs` rédige la réponse à partir de son contenu.
6. Si le routeur ne trouve rien, `retrieveHybrid` classe les fiches par lexical et par dense.
7. Si le score est trop faible, l'agent refuse avec un texte localisé.
8. La réponse part dans le chat avec ses sources.

## Le code, étape par étape

### Étape 1 : le corpus est la source de vérité

Chaque fiche contient un identifiant, un titre, des mots-clés, un corps dans les trois langues et une source.

```lib/agent/corpus.ts
export type KnowledgeDoc = {
  id: string;
  title: Record<Locale, string>;
  keywords: string[];
  body: Record<Locale, string>;
  source: Record<Locale, string>;
};
```

`lexicalRanking` normalise la question et le corps, puis compte les correspondances. Ce score est utilisé seul si les embeddings sont absents.

### Étape 2 : demander au modèle de choisir une fiche

Le routeur ne reçoit pas une recherche vectorielle. Il reçoit le catalogue complet des 17 fiches. Le prompt lui interdit de choisir une fiche « du même thème » si elle ne répond pas.

```lib/agent/retrieval.ts
const result = await chatJSON<{
  answerable?: boolean;
  docIds?: string[];
  evidence?: Record<string, string>;
}>(
  [
    { role: "system", content: `Tu es le routeur documentaire.
Sélectionne uniquement les fiches qui contiennent explicitement la réponse.
Pour chaque fiche, copie la phrase exacte du corps qui répond.
Si aucune fiche ne répond, answerable vaut false.
Réponds uniquement par un JSON valide :
{"answerable":true|false,"docIds":["id1"],"evidence":{"id1":"phrase exacte"}}` },
    { role: "user", content: `Question : ${query}\n\nFiches :\n${buildCatalog(locale)}` },
  ],
  { maxTokens: 320, temperature: 0, timeoutMs: 8_000 }
);
```

Le catalogue contient le titre, les mots-clés et le corps complet de chaque fiche. Le modèle voit donc tout le corpus, mais doit citer une preuve.

### Étape 3 : vérifier la preuve, pas seulement l'identifiant

Le code ne fait pas confiance au modèle. Il vérifie que l'identifiant existe, puis que la phrase citée est réellement présente dans le corps de la fiche.

```lib/agent/retrieval.ts
const docs = ids
  .slice(0, 3)
  .map((id) => corpus.find((doc) => doc.id === id))
  .filter((doc): doc is KnowledgeDoc => Boolean(doc))
  .filter((doc) => {
    const quote = evidence[doc.id];
    if (typeof quote !== "string" || quote.trim().length < 8) return false;
    return normalizeEvidence(doc.body[locale]).includes(
      normalizeEvidence(quote)
    );
  });
```

`normalizeEvidence` met en minuscules, retire les accents et la ponctuation. La comparaison reste donc tolérante aux virgules et aux majuscules, mais pas aux inventions.

Si une seule fiche est invalidée, elle est retirée. Si aucune ne reste, le routeur renvoie `none`.

### Étape 4 : répondre à partir des fiches validées

`answerFromDocs` construit un contexte avec les fiches retenues. Le modèle doit répondre en trois phrases maximum, uniquement avec les faits du contexte.

```lib/agent/graph.ts
const context = docs
  .map((doc, index) =>
    `Document ${index + 1} : ${doc.title[state.locale]}\n${doc.body[state.locale]}`
  )
  .join("\n\n");

const generated = await chatCompletion(
  [
    { role: "system", content: `Tu es l'agent Knowledge.
Réponds uniquement à partir des documents fournis, en trois phrases maximum.
N'utilise que les faits explicitement présents.
Si aucun document ne contient la réponse, réponds exactement :
"Je n'ai pas cette information dans ma base."` },
    { role: "user", content: `Question : ${state.query}\n\n${context}` },
  ],
  { maxTokens: 320, temperature: 0.1, timeoutMs: 12_000 }
);
```

Si le modèle refuse, la réponse est remplacée par le texte de refus localisé et les sources sont vidées.

### Étape 5 : le retrieval hybride

Quand le routeur n'est pas disponible, `retrieveHybrid` combine deux signaux. Le lexical est rapide et explicable. Le dense capte les reformulations.

```lib/agent/retrieval.ts
const LEXICAL_WEIGHT = 0.65;
const DENSE_WEIGHT = 0.35;
const DENSE_AGREEMENT = 0.24;

const lexicalPart = Math.min(1, lexicalScore / 6) * LEXICAL_WEIGHT;
const densePart = denseScore * DENSE_WEIGHT;
const score = lexicalPart + densePart;
```

Les candidats viennent des huit meilleures fiches lexicales et des trois meilleures fiches denses. Le score final mélange les deux.

### Étape 6 : décider si le résultat est fiable

Un score élevé ne suffit pas. Le code vérifie aussi que le lexical et le dense sont d'accord.

```lib/agent/retrieval.ts
const lexicalConfident = (lexicalTop?.score ?? 0) >= 3;
const denseAgrees =
  Boolean(lexicalTop && denseTop) &&
  lexicalTop.doc.id === denseTop.doc.id &&
  denseTop.score >= DENSE_AGREEMENT;
const nearLexical = (lexicalTop?.score ?? 0) >= 2;
const confident = lexicalConfident || (nearLexical && denseAgrees);
```

Si `confident` est faux et qu'il y a des résultats, `needsReview` passe à vrai. Knowledge préfère alors le refus au risque d'une réponse approximative.

### Étape 7 : les embeddings et leur fraîcheur

Le fichier `embeddings.json` contient le modèle, les dimensions, un hash du corpus et les vecteurs. Au chargement, le code vérifie le modèle, les dimensions et le hash.

```lib/agent/retrieval.ts
if (parsed.model !== EMBED_MODEL || parsed.dimensions !== EMBED_DIMS) {
  embeddingFile = null;
  return null;
}

const hash = createHash("sha256")
  .update(JSON.stringify(corpus))
  .digest("hex");

if (parsed.corpusHash !== hash) {
  console.warn("[retrieval] embeddings obsolètes, relancer embeddings:build");
  embeddingFile = null;
  return null;
}
```

Si le corpus change et que les vecteurs ne sont pas reconstruits, le système repasse au lexical. Il ne répond pas avec des vecteurs périmés.

### Étape 8 : le repli quand tout échoue

S'il n'y a aucun résultat, Knowledge renvoie un refus localisé. Si le LLM est disponible, il peut reformuler ce refus, mais sans ajouter de fait.

```lib/agent/graph.ts
if (retrieval.hits.length === 0) {
  let reply = texts.fallback[state.locale];

  if (llmEnabled()) {
    const generated = await chatCompletion(
      [
        { role: "system", content: `Tu n'as pas cette information dans ta base.
Dis-le naturellement, puis propose un agent humain ou une réclamation.
N'invente aucun fait sur le réseau, les horaires ou les tarifs.` },
        { role: "user", content: state.query },
      ],
      { maxTokens: 160, temperature: 0.4, timeoutMs: 10_000 }
    );

    if (generated && generated.length <= 600) reply = generated;
  }

  return { reply, sources: [] };
}
```

Le refus est une fonctionnalité, pas un bug. Il protège la crédibilité du service.

## Exemple concret

Question : « Quel est le tarif du ticket simple et de l'abonnement étudiant ? »

1. Le Superviseur route vers Knowledge.
2. Le routeur sélectionne la fiche `fares`.
3. Il cite la phrase du ticket à 8 DH et celle de l'abonnement étudiant à 150 DH.
4. Le code vérifie que les deux phrases existent dans le corps de la fiche.
5. `answerFromDocs` rédige : ticket 8 DH, abonnement étudiant 150 DH par mois.
6. Le chat affiche la source « Tarifs et titres de transport ».

Question : « Quels sont les moyens de paiement ? »

1. Le routeur ne trouve pas de fiche qui répond explicitement.
2. `answerable` vaut `false`.
3. Knowledge refuse et propose une réclamation ou un agent.

## Les garde-fous

1. Une fiche doit contenir une phrase de preuve, pas seulement un mot-clé.
2. La preuve est vérifiée comme sous-chaîne du corps.
3. Maximum trois fiches par réponse.
4. Le modèle ne répond qu'à partir du contexte fourni.
5. Les embeddings sont invalidés si le corpus change.
6. Un score incertain déclenche un refus, pas une réponse approximative.
7. Les sources ne sont affichées que si la réponse n'est pas un refus.

## Les mots à connaître

**RAG** : recherche de documents, puis génération d'une réponse à partir de ces documents.

**Embedding** : vecteur de nombres qui représente le sens d'un texte. Deux textes proches ont des vecteurs proches.

**Lexical** : comparaison de mots normalisés. Rapide, explicable, mais sensible aux reformulations.

**Dense** : comparaison de vecteurs. Meilleur sur les reformulations, mais moins explicable.

**Preuve** : phrase exacte du document qui justifie la réponse. C'est le garde-fou principal contre l'invention.

## À retenir

Knowledge combine un routeur qui voit les 17 fiches, une preuve textuelle vérifiée et un retrieval hybride de secours. Le système peut refuser, et ce refus est contrôlé.

Le corpus reste la seule source de vérité. Les embeddings accélèrent la recherche, ils ne remplacent pas les fiches.

## Questions possibles

**Pourquoi ne pas utiliser une base vectorielle ?** Pour 17 fiches, un fichier JSON de 51 vecteurs suffit. Cela évite un service supplémentaire et rend la démo portable.

**Que se passe-t-il si le modèle cite une phrase qui n'existe pas ?** La fiche est retirée. Si aucune fiche ne reste, Knowledge refuse.

**Pourquoi garder le lexical ?** Parce qu'il fonctionne sans réseau, sans clé API et sans embeddings. C'est le mode de secours de la démonstration.

## Checklist de présentation

- Je sais expliquer le rôle de Knowledge en une phrase.
- Je sais ouvrir `retrieval.ts` et montrer `routeDocuments`.
- Je sais décrire le trajet d'une question sans lire mes notes.
- Je sais citer un garde-fou et expliquer pourquoi il existe.
- Je sais répondre à la question : « que se passe-t-il si le corpus ne contient pas la réponse ? »
