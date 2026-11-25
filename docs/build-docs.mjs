import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

const docs = [
  {
    src: "cahier-des-charges.md",
    out: "cahier-des-charges.html",
    kicker: "Spécifications fonctionnelles et techniques",
    title: "Cahier des charges",
    sub: "Service client augmenté par agents IA, intégré au site du réseau",
    meta: [
      ["Projet", "CasaMove, réseau de transport urbain"],
      ["Version", "1.1"],
      ["Date", "20 novembre 2026"],
      ["Statut", "Version de travail, soumise à validation"],
      ["Périmètre", "Chat in-page, réclamation, console agents, VoC"],
    ],
    foot: "CasaMove · Cahier des charges v1.1 · 20 novembre 2026",
  },
  {
    src: "note-justification-langgraph.md",
    out: "note-justification-langgraph.html",
    slug: "note",
    kicker: "Note d'architecture et de décision",
    title: "LangGraph ou plateforme ABA",
    sub: "Pourquoi l'orchestration doit rester dans LangGraph",
    meta: [
      ["Projet", "CasaMove, service client"],
      ["Version", "1.1"],
      ["Date", "20 novembre 2026"],
      ["Objet", "Arbitrage entre LangGraph et la plateforme Agentic d'ABA"],
      ["Décision", "LangGraph pour le cœur, plateforme en composant"],
    ],
    foot: "CasaMove · Note de justification v1.1 · 20 novembre 2026",
  },
  {
    src: "scenario-demo.md",
    out: "scenario-demo.html",
    kicker: "Fiche de démonstration",
    title: "Soutenance, 5 minutes",
    sub: "CasaMove, clics exacts et réponses attendues",
    meta: [
      ["Projet", "CasaMove, service client"],
      ["Version", "1.0"],
      ["Date", "21 novembre 2026"],
      ["Durée", "5 minutes, 2 fenêtres"],
      ["Pré-requis", "Postgres démarré, seed chargé, serveur lancé"],
    ],
    foot: "CasaMove · Fiche de démonstration v1.0 · 21 novembre 2026",
  },
  {
    src: "guide-utilisateur.md",
    out: "guide-utilisateur.html",
    kicker: "Guide utilisateur",
    title: "CasaMove, mode d'emploi",
    sub: "Réclamations, suivi, contacts, tarifs et informations utiles",
    meta: [
      ["Projet", "CasaMove, service client"],
      ["Version", "1.0"],
      ["Date", "21 novembre 2026"],
      ["Public", "Usagers du réseau"],
      ["Sources", "Guide voyageurs 2026, procédures CasaMove"],
    ],
    foot: "CasaMove · Guide utilisateur v1.0 · 21 novembre 2026",
  },
];

const cover = (d) => `
<header class="cover">
  <div class="cover__top">
    <div class="cover__brand">
      <span class="cover__mark"></span>
      <span class="cover__name">CasaMove</span>
    </div>
    <p class="cover__kicker">${d.kicker}</p>
    <h1>${d.title}</h1>
    <p class="cover__sub">${d.sub}</p>
    <div class="cover__rule"></div>
  </div>
  <div>
    <table class="cover__meta">
      ${d.meta.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("\n      ")}
    </table>
    <p class="cover__foot">Document de travail. Toute diffusion hors équipe projet requiert l'accord du responsable de projet.</p>
  </div>
</header>`;

let built = 0;

for (const d of docs) {
  const md = readFileSync(new URL(d.src, import.meta.url), "utf8");
  const body = marked.parse(md);
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${d.title} · CasaMove</title>
  <link rel="stylesheet" href="print.css" />
</head>
<body class="doc--${d.slug ?? "cahier"}">
${cover(d)}
<main>
${body}
<p class="doc-foot">${d.foot}</p>
</main>
</body>
</html>
`;
  writeFileSync(new URL(d.out, import.meta.url), html, "utf8");
  built += 1;
  console.log(`ok ${d.out}`);
}

console.log(`${built} documents générés`);
