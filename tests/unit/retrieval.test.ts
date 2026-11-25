import { describe, expect, it } from "vitest";
import { retrieve } from "@/lib/agent/corpus";
import type { Locale } from "@/content/dictionary";

function docId(query: string, locale: Locale = "fr") {
  return retrieve(query, locale)?.doc.id ?? null;
}

describe("retrieval lexical", () => {
  const cases: [string, Locale, string][] = [
    ["Quel est le dernier tram ?", "fr", "hours"],
    ["Combien coûte le ticket ?", "fr", "fares"],
    ["Comment déposer une réclamation ?", "fr", "complaint-howto"],
    ["Comment suivre ma réclamation ?", "fr", "complaint-tracking"],
    ["Comment contacter le service client ?", "fr", "contact"],
    ["J'ai perdu mon objet", "fr", "lost-payment"],
    ["Comment fonctionne une correspondance ?", "fr", "correspondence"],
    ["Les stations accessibles en fauteuil ?", "fr", "accessibility"],
    ["Quelles agences à Casablanca ?", "fr", "agencies"],
    ["C'est combien un trajet ?", "fr", "fares"],
    ["que sont les tarif existantes aujourd'hui ?", "fr", "fares"],
    ["Ça roule jusqu'à quelle heure ?", "fr", "hours"],
    ["Le tram fonctionne jusqu'à quand le soir ?", "fr", "hours"],
    ["J'ai perdu mon sac dans le tram", "fr", "lost-payment"],
    ["Où en est ma réclamation ?", "fr", "complaint-tracking"],
    ["À quel moment le réseau ferme-t-il ?", "fr", "hours"],
    ["Où puis-je acheter un ticket ?", "fr", "purchase"],
    ["Combien de temps dure une correspondance ?", "fr", "correspondence"],
    ["Comment faire pour réclamer ?", "fr", "complaint-howto"],
    ["ما هو ثمن التذكرة؟", "ar", "fares"],
    ["What is the last tram?", "en", "hours"],
  ];

  for (const [query, locale, expected] of cases) {
    it(`retrouve ${expected} pour "${query}"`, () => {
      expect(docId(query, locale)).toBe(expected);
    });
  }

  it("refuse une question hors corpus", () => {
    expect(retrieve("Quelle est la couleur du tram ?", "fr")).toBeNull();
  });

  it("tolère les accents et la casse", () => {
    expect(docId("COMMENT DEPOSER UNE RECLAMATION", "fr")).toBe(
      "complaint-howto"
    );
  });
});
