import fs from "node:fs";
import { marked } from "marked";
import PDFDocument from "pdfkit";

const DIR = new URL("./agents/", import.meta.url);
const OUT_DIR = new URL("./agents/", import.meta.url);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 66;

const INDIGO = "#1B2A4A";
const AMBER = "#F5A524";
const INK = "#222222";
const MUTED = "#5B6579";
const LINE = "#E3E7EE";
const CODE_BG = "#F5F7FB";
const CALLOUT_BG = "#FFF8E8";

const AGENTS = [
  {
    number: "01",
    slug: "01-superviseur",
    file: "Agent_01_Superviseur_CasaMove.pdf",
    title: "Le Superviseur",
    category: "Chef d'orchestre",
    subtitle:
      "Il lit chaque message, comprend l'intention et choisit l'agent qui doit répondre.",
    filesShort: "lib/agent/graph.ts, lib/agent/classification.ts",
    problem:
      "Un message peut demander une information, un suivi, une réclamation ou une simple salutation. Sans routage, chaque agent devrait tout savoir faire. Le Superviseur sépare ces responsabilités.",
    meta: [
      ["Rôle", "Classer puis router chaque message"],
      ["Fichiers", "lib/agent/graph.ts, lib/agent/classification.ts"],
      ["Entrées", "Message, langue, session, usager"],
      ["Sorties", "Intention, thème, priorité, sentiment, route"],
    ],
  },
  {
    number: "02",
    slug: "02-support",
    file: "Agent_02_Support_CasaMove.pdf",
    title: "L'Agent Support",
    category: "Service transactionnel",
    subtitle:
      "Il consulte un dossier, liste les dossiers d'un usager, vérifie un abonnement ou une perturbation.",
    filesShort: "lib/agent/support.ts, lib/agent/tickets.ts",
    problem:
      "L'usager ne doit pas chercher son dossier dans les écrans. Support va lire la base à sa place, avec les mêmes règles de confidentialité.",
    meta: [
      ["Rôle", "Répondre aux demandes transactionnelles"],
      ["Fichiers", "support.ts, tickets.ts, signals.ts, subscriptions.ts"],
      ["Entrées", "Question, usager connecté, langue"],
      ["Sorties", "Réponse, données d'outil, dossier éventuel"],
    ],
  },
  {
    number: "03",
    slug: "03-knowledge",
    file: "Agent_03_Knowledge_CasaMove.pdf",
    title: "L'Agent Knowledge",
    category: "Réponse documentaire",
    subtitle:
      "Il répond avec les 17 fiches du réseau, cite une preuve et refuse quand il ne sait pas.",
    filesShort: "lib/agent/retrieval.ts, lib/agent/corpus.ts",
    problem:
      "Le service doit répondre sur les horaires, les tarifs et les procédures sans inventer. Knowledge transforme 17 fiches contrôlées en réponses courtes et sourcées.",
    meta: [
      ["Rôle", "Répondre à partir du corpus, sans inventer"],
      ["Fichiers", "retrieval.ts, corpus.ts, embeddings.ts, graph.ts"],
      ["Entrées", "Question, langue"],
      ["Sorties", "Réponse sourcée ou refus explicite"],
    ],
  },
  {
    number: "04",
    slug: "04-reclamation",
    file: "Agent_04_Reclamation_CasaMove.pdf",
    title: "L'Agent Réclamation",
    category: "Dossier et validation humaine",
    subtitle:
      "Il transforme un problème vécu en dossier suivi, avec priorité, échéance et validation par un agent.",
    filesShort: "lib/agent/graph.ts, lib/agent/tickets.ts",
    problem:
      "Une réclamation engage le réseau. Il faut un numéro, une échéance, une trace et une validation humaine avant de répondre.",
    meta: [
      ["Rôle", "Créer, qualifier et faire valider un dossier"],
      ["Fichiers", "graph.ts, tickets.ts, route decision, console admin"],
      ["Entrées", "Réclamation, classification, usager"],
      ["Sorties", "Dossier, brouillon, statut, journal"],
    ],
  },
  {
    number: "05",
    slug: "05-succes-client",
    file: "Agent_05_Succes_Client_CasaMove.pdf",
    title: "L'Agent Succès client",
    category: "Proactivité",
    subtitle:
      "Il parle avant qu'on lui demande : perturbations, informations et renouvellement d'abonnement.",
    filesShort: "lib/agent/signals.ts, lib/agent/scheduler.ts",
    problem:
      "Une perturbation ou une échéance d'abonnement ne se découvre pas dans un message entrant. Succès client pousse l'information au bon usager, au bon moment.",
    meta: [
      ["Rôle", "Publier et suivre des alertes ciblées"],
      ["Fichiers", "signals.ts, scheduler.ts, route signals, ChatWidget"],
      ["Entrées", "Ligne, audience, abonnement, sévérité"],
      ["Sorties", "Signal, livraison, lecture, masquage"],
    ],
  },
];

let doc;
let currentAgent;

function inlineText(items = []) {
  return items
    .map((item) => {
      if (item.type === "strong" || item.type === "em") {
        return inlineText(item.tokens ?? []);
      }
      if (item.type === "codespan") return item.text;
      if (item.type === "link") return inlineText(item.tokens ?? []) || item.text;
      return item.text ?? "";
    })
    .join("");
}

function clean(value) {
  return String(value ?? "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function drawHeader() {
  doc
    .fillColor(INDIGO)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("CASAMOVE", MARGIN, 30, { characterSpacing: 1.4 });

  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text(currentAgent.title, MARGIN, 30, {
      width: CONTENT_W,
      align: "right",
    });

  doc
    .moveTo(MARGIN, 46)
    .lineTo(PAGE_W - MARGIN, 46)
    .strokeColor(LINE)
    .lineWidth(0.6)
    .stroke();

  doc.y = 74;
}

function newPage() {
  doc.addPage();
  drawHeader();
}

function ensure(height) {
  if (doc.y + height > BOTTOM) {
    newPage();
  }
}

function h2(text) {
  const reserved = /Checklist de présentation/.test(text) ? 220 : 66;
  ensure(reserved);
  doc.moveDown(0.8);
  doc
    .fillColor(INDIGO)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(text, { width: CONTENT_W });

  doc.moveDown(0.3);
  doc.rect(MARGIN, doc.y, 58, 3).fill(AMBER);
  doc.moveDown(0.7);
  doc.fillColor(INK).font("Helvetica").fontSize(10.2);
}

function h3(text) {
  ensure(42);
  doc.moveDown(0.4);
  doc
    .fillColor(INDIGO)
    .font("Helvetica-Bold")
    .fontSize(11.4)
    .text(text, { width: CONTENT_W });
  doc.moveDown(0.35);
  doc.fillColor(INK).font("Helvetica").fontSize(10.2);
}

function paragraph(text) {
  const value = clean(text);
  if (!value) return;
  doc.font("Helvetica").fontSize(10.2);
  const height = doc.heightOfString(value, { width: CONTENT_W, lineGap: 3 });
  ensure(height + 8);
  doc
    .fillColor(INK)
    .text(value, { width: CONTENT_W, lineGap: 3, align: "left" });
  doc.moveDown(0.55);
}

function paragraphToken(token) {
  const tokens = token.tokens ?? [];
  const first = tokens[0];

  if (first?.type === "strong") {
    const lead = clean(inlineText(first.tokens ?? []) || first.text);
    if (lead.endsWith("?")) {
      ensure(34);
      doc
        .fillColor(INDIGO)
        .font("Helvetica-Bold")
        .fontSize(10.4)
        .text(lead, { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.15);
      const rest = inlineText(tokens.slice(1));
      if (rest) paragraph(rest);
      return;
    }
  }

  paragraph(inlineText(tokens) || token.text);
}

function list(token) {
  const start = Number(token.start ?? 1);
  token.items.forEach((item, index) => {
    const text = clean(inlineText(item.tokens ?? []) || item.text);
    const prefix = token.ordered ? `${start + index}. ` : "• ";
    doc.font("Helvetica").fontSize(10.1);
    const height = doc.heightOfString(text, {
      width: CONTENT_W - 26,
      lineGap: 2.5,
    });
    ensure(height + 10);

    const y = doc.y;
    doc
      .fillColor(token.ordered ? AMBER : INDIGO)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(prefix, MARGIN + 2, y, { width: 22, lineBreak: false });

    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(10.1)
      .text(text, MARGIN + 27, y, {
        width: CONTENT_W - 27,
        lineGap: 2.5,
      });
    doc.y = Math.max(doc.y, y + height) + 4;
  });
  doc.moveDown(0.35);
}

function table(token) {
  const header = token.header.map((cell) => clean(cell.text));
  const rows = token.rows.map((row) =>
    row.map((cell) => clean(cell.text))
  );
  const columns = header.length;
  const widths =
    columns === 2
      ? [CONTENT_W * 0.38, CONTENT_W * 0.62]
      : columns === 3
        ? [CONTENT_W * 0.24, CONTENT_W * 0.32, CONTENT_W * 0.44]
        : Array.from({ length: columns }, () => CONTENT_W / columns);

  function drawHeaderRow(y) {
    const height = 24;
    doc.rect(MARGIN, y, CONTENT_W, height).fill(INDIGO);
    let x = MARGIN;
    header.forEach((cell, index) => {
      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(8.3)
        .text(cell, x + 6, y + 7, {
          width: widths[index] - 12,
          height: height - 8,
          ellipsis: true,
        });
      x += widths[index];
    });
    return y + height;
  }

  ensure(60);
  let y = drawHeaderRow(doc.y);

  rows.forEach((row, rowIndex) => {
    doc.font("Helvetica").fontSize(8.4);
    let rowHeight = 20;
    row.forEach((cell, index) => {
      rowHeight = Math.max(
        rowHeight,
        doc.heightOfString(cell, { width: widths[index] - 12 }) + 12
      );
    });

    if (y + rowHeight > BOTTOM) {
      newPage();
      y = drawHeaderRow(doc.y);
    }

    if (rowIndex % 2 === 0) {
      doc.rect(MARGIN, y, CONTENT_W, rowHeight).fill("#F6F8FB");
    }

    let x = MARGIN;
    row.forEach((cell, index) => {
      doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(8.4)
        .text(cell, x + 6, y + 6, {
          width: widths[index] - 12,
          lineGap: 1.5,
        });
      x += widths[index];
    });

    doc
      .moveTo(MARGIN, y + rowHeight)
      .lineTo(PAGE_W - MARGIN, y + rowHeight)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();

    y += rowHeight;
  });

  doc.y = y + 10;
}

function codeBlock(token) {
  const label = token.lang?.trim() || "Code";
  const lines = token.text.replace(/\t/g, "  ").split("\n");

  doc.font("Courier").fontSize(7.8);
  let innerHeight = 0;
  for (const line of lines) {
    innerHeight += doc.heightOfString(line || " ", {
      width: CONTENT_W - 26,
      lineGap: 1,
    });
  }

  const boxHeight = 24 + innerHeight + 12;
  ensure(boxHeight + 8);

  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_W, boxHeight, 5).fill(CODE_BG);
  doc.rect(MARGIN, y, 3, boxHeight).fill(AMBER);

  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(7.2)
    .text(label, MARGIN + 12, y + 6, {
      width: CONTENT_W - 24,
      ellipsis: true,
    });

  doc.fillColor(INK).font("Courier").fontSize(7.8);
  let lineY = y + 22;
  for (const line of lines) {
    const height = doc.heightOfString(line || " ", {
      width: CONTENT_W - 26,
      lineGap: 1,
    });
    doc.text(line || " ", MARGIN + 12, lineY, {
      width: CONTENT_W - 26,
      lineGap: 1,
    });
    lineY += height;
  }

  doc.y = y + boxHeight + 10;
  doc.fillColor(INK).font("Helvetica").fontSize(10.2);
}

function callout(token) {
  const parts = (token.tokens ?? [])
    .map((item) => clean(inlineText(item.tokens ?? []) || (item.text ?? "")))
    .filter(Boolean);
  const text = parts.join("\n");
  if (!text) return;

  doc.font("Helvetica").fontSize(9.8);
  const height = doc.heightOfString(text, {
    width: CONTENT_W - 30,
    lineGap: 2.5,
  });
  const boxHeight = height + 22;
  ensure(boxHeight + 10);

  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_W, boxHeight, 6).fill(CALLOUT_BG);
  doc.rect(MARGIN, y, 4, boxHeight).fill(AMBER);
  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(9.8)
    .text(text, MARGIN + 16, y + 11, {
      width: CONTENT_W - 30,
      lineGap: 2.5,
    });

  doc.y = y + boxHeight + 10;
  doc.fillColor(INK).font("Helvetica").fontSize(10.2);
}

function infoBox(title, text) {
  doc.font("Helvetica").fontSize(9.6);
  const height = doc.heightOfString(text, {
    width: CONTENT_W - 30,
    lineGap: 2.5,
  });
  const boxHeight = height + 38;
  ensure(boxHeight + 10);

  const y = doc.y;
  doc.roundedRect(MARGIN, y, CONTENT_W, boxHeight, 6).fill("#F6F8FB");
  doc.rect(MARGIN, y, 4, boxHeight).fill(INDIGO);
  doc
    .fillColor(INDIGO)
    .font("Helvetica-Bold")
    .fontSize(9.2)
    .text(title, MARGIN + 16, y + 10, { width: CONTENT_W - 30 });
  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(9.6)
    .text(text, MARGIN + 16, y + 26, {
      width: CONTENT_W - 30,
      lineGap: 2.5,
    });

  doc.y = y + boxHeight + 10;
  doc.fillColor(INK).font("Helvetica").fontSize(10.2);
}

function divider() {
  doc.moveDown(0.5);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(PAGE_W - MARGIN, doc.y)
    .strokeColor(LINE)
    .lineWidth(0.6)
    .stroke();
  doc.moveDown(0.6);
}

function notesBlock() {
  if (doc.y + 190 > BOTTOM) return;
  doc.moveDown(0.8);
  doc
    .fillColor(INDIGO)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Notes personnelles", { width: CONTENT_W });
  doc.moveDown(0.7);

  let y = doc.y;
  for (let index = 0; index < 6; index += 1) {
    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_W - MARGIN, y)
      .strokeColor(LINE)
      .lineWidth(0.6)
      .stroke();
    y += 26;
  }
  doc.y = y;
}

function cover(agent) {
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(INDIGO);

  doc.roundedRect(MARGIN, 56, 30, 30, 8).fill(AMBER);
  doc
    .fillColor(INDIGO)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("CM", MARGIN, 66, { width: 30, align: "center" });

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("CASAMOVE", MARGIN + 42, 62, { characterSpacing: 1.6 });

  doc
    .fillColor("#FFD88F")
    .font("Helvetica")
    .fontSize(8.5)
    .text(`FICHE AGENT · ${agent.number} / 05`, MARGIN, 220, {
      characterSpacing: 2.2,
    });

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(30)
    .text(agent.title, MARGIN, 248, { width: CONTENT_W - 10, lineGap: 4 });

  doc.rect(MARGIN, 330, 52, 4).fill(AMBER);

  doc
    .fillColor("#C4CEDE")
    .font("Helvetica")
    .fontSize(12.5)
    .text(agent.subtitle, MARGIN, 356, {
      width: CONTENT_W - 40,
      lineGap: 4,
    });

  const oldBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.fillOpacity(0.07);
  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(150)
    .text(agent.number, PAGE_W - 230, PAGE_H - 230, {
      width: 180,
      align: "right",
      lineBreak: false,
    });
  doc.restore();
  doc.page.margins.bottom = oldBottom;

  doc
    .fillColor("#8FA0BD")
    .font("Helvetica")
    .fontSize(8.5)
    .text("CasaMove · Service client augmenté par agents", MARGIN, PAGE_H - 96);
  doc.text("Code source : " + agent.filesShort, MARGIN, PAGE_H - 82);
  doc.text("Version 1.0 · 25 novembre 2026", MARGIN, PAGE_H - 68);

  doc.addPage();
  drawHeader();
}

function identityPage(agent, headings) {
  doc
    .fillColor(INDIGO)
    .font("Helvetica-Bold")
    .fontSize(21)
    .text("Carte d'identité", MARGIN, doc.y);

  doc.moveDown(0.3);
  doc.rect(MARGIN, doc.y, 52, 3).fill(AMBER);
  doc.moveDown(0.8);

  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(10)
    .text(agent.subtitle, { width: CONTENT_W, lineGap: 3 });
  doc.moveDown(1);

  const tableToken = {
    header: [{ text: "Élément" }, { text: "Valeur" }],
    rows: agent.meta.map(([key, value]) => [
      { text: key },
      { text: value },
    ]),
  };
  table(tableToken);

  doc.moveDown(0.6);
  doc
    .fillColor(MUTED)
    .font("Helvetica-Oblique")
    .fontSize(9)
    .text(
      "Les blocs sombres citent le code réel. Les encadrés jaunes donnent la phrase à retenir.",
      { width: CONTENT_W, lineGap: 2 }
    );

  doc.moveDown(0.8);
  infoBox("Le problème qu'il résout", agent.problem);

  doc.moveDown(0.7);
  doc
    .fillColor(INDIGO)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text("Dans cette fiche", { width: CONTENT_W });
  doc.moveDown(0.4);

  headings.forEach((heading, index) => {
    const title = clean(heading.text);
    doc.font("Helvetica").fontSize(10);
    const height = doc.heightOfString(title, { width: CONTENT_W - 26 });
    ensure(height + 10);
    const y = doc.y;

    doc
      .fillColor(AMBER)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`${index + 1}.`, MARGIN + 2, y, {
        width: 20,
        lineBreak: false,
      });
    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(10)
      .text(title, MARGIN + 26, y, {
        width: CONTENT_W - 26,
        lineGap: 2,
      });
    doc.y = y + height + 5;
  });

  newPage();
}

function footers() {
  const range = doc.bufferedPageRange();
  for (let index = 1; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fillColor("#8A93A6")
      .font("Helvetica")
      .fontSize(7.5)
      .text(
        `CasaMove · Fiche agent ${currentAgent.number}/05 · ${currentAgent.title}`,
        MARGIN,
        PAGE_H - 34,
        { width: CONTENT_W * 0.75, lineBreak: false }
      );
    doc.text(`${index + 1} / ${range.count}`, MARGIN + CONTENT_W * 0.75, PAGE_H - 34, {
      width: CONTENT_W * 0.25,
      align: "right",
      lineBreak: false,
    });
    doc.page.margins.bottom = bottom;
  }
}

function buildAgent(agent) {
  const markdown = fs.readFileSync(new URL(`./${agent.slug}.md`, DIR), "utf8");
  const tokens = marked.lexer(markdown);
  const headings = tokens.filter(
    (token) => token.type === "heading" && token.depth === 2
  );

  const output = new URL(`./${agent.file}`, OUT_DIR);

  doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: `CasaMove · ${agent.title}`,
      Author: "CasaMove",
      Subject: `Fiche agent ${agent.number}/05`,
      Keywords: "CasaMove, agent, code, LangGraph, Next.js",
    },
  });

  const stream = fs.createWriteStream(output);
  doc.pipe(stream);

  currentAgent = agent;
  cover(agent);
  identityPage(agent, headings);

  let section = 0;

  for (const token of tokens) {
    if (token.type === "heading") {
      if (token.depth === 1) {
        continue;
      }
      if (token.depth === 2) {
        section += 1;
        h2(`${section}. ${clean(token.text)}`);
        continue;
      }
      h3(clean(token.text));
      continue;
    }

    if (token.type === "paragraph") {
      paragraphToken(token);
      continue;
    }

    if (token.type === "list") {
      list(token);
      continue;
    }

    if (token.type === "table") {
      table(token);
      continue;
    }

    if (token.type === "code") {
      codeBlock(token);
      continue;
    }

    if (token.type === "blockquote") {
      callout(token);
      continue;
    }

    if (token.type === "hr") {
      divider();
      continue;
    }
  }

  notesBlock();
  footers();
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(output));
    stream.on("error", reject);
  });
}

fs.mkdirSync(DIR, { recursive: true });

for (const agent of AGENTS) {
  const output = await buildAgent(agent);
  console.log(`ok ${output.pathname.split("/").pop()}`);
}
