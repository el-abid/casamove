import fs from "node:fs";
import PDFDocument from "pdfkit";
import { marked } from "marked";

const source = new URL("./guide-utilisateur.md", import.meta.url);
const target = new URL("./Guide_Utilisateur_CasaMove_v1.pdf", import.meta.url);

const md = fs.readFileSync(source, "utf8");
const tokens = marked.lexer(md);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INDIGO = "#1B2A4A";
const AMBER = "#F5A524";
const INK = "#222222";
const MUTED = "#5B6579";
const LINE = "#E3E7EE";

const doc = new PDFDocument({
  size: "A4",
  margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
  bufferPages: true,
  info: {
    Title: "CasaMove, mode d'emploi",
    Author: "CasaMove",
    Subject: "Guide utilisateur",
  },
});
doc.pipe(fs.createWriteStream(target));

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

function needSpace(height) {
  if (doc.y + height > PAGE_H - MARGIN - 24) {
    doc.addPage();
  }
}

function heading(text, level) {
  needSpace(level === 2 ? 70 : 50);
  doc.moveDown(level === 2 ? 1.1 : 0.7);
  doc
    .fillColor(INDIGO)
    .font("Helvetica-Bold")
    .fontSize(level === 2 ? 17 : 12.5)
    .text(clean(text), { width: CONTENT_W });

  if (level === 2) {
    doc.moveDown(0.35);
    doc.rect(MARGIN, doc.y, 64, 3).fill(AMBER);
    doc.moveDown(0.7);
  } else {
    doc.moveDown(0.3);
  }

  doc.fillColor(INK).font("Helvetica").fontSize(10.5);
}

function paragraph(text) {
  needSpace(48);
  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(10.5)
    .text(clean(text), { width: CONTENT_W, lineGap: 3, align: "left" });
  doc.moveDown(0.55);
}

function list(token) {
  needSpace(30 + token.items.length * 18);
  token.items.forEach((item, index) => {
    needSpace(24);
    const prefix = token.ordered ? `${index + 1}. ` : "• ";
    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(10.5)
      .text(prefix + clean(item.text), MARGIN + 8, doc.y, {
        width: CONTENT_W - 8,
        lineGap: 2.5,
        indent: 10,
      });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.35);
}

function table(token) {
  const columns = token.header.length;
  const rows = [token.header, ...token.rows];
  const rowHeight = 22;
  const colWidth = CONTENT_W / columns;

  needSpace(rowHeight * rows.length + 16);

  rows.forEach((row, rowIndex) => {
    if (doc.y + rowHeight > PAGE_H - MARGIN - 24) {
      doc.addPage();
    }

    const y = doc.y;

    if (rowIndex === 0) {
      doc.rect(MARGIN, y, CONTENT_W, rowHeight).fill(INDIGO);
    } else if (rowIndex % 2 === 0) {
      doc.rect(MARGIN, y, CONTENT_W, rowHeight).fill("#F6F8FB");
    }

    row.forEach((cell, colIndex) => {
      const text = clean(cell.text);
      const x = MARGIN + colIndex * colWidth + 6;

      doc
        .fillColor(rowIndex === 0 ? "#FFFFFF" : INK)
        .font(rowIndex === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .text(text, x, y + 6, {
          width: colWidth - 12,
          height: rowHeight - 6,
          ellipsis: true,
        });
    });

    doc
      .moveTo(MARGIN, y + rowHeight)
      .lineTo(MARGIN + CONTENT_W, y + rowHeight)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();

    doc.y = y + rowHeight;
  });

  doc.moveDown(0.7);
}

/* ---------- Couverture ---------- */

doc.rect(0, 0, PAGE_W, PAGE_H).fill(INDIGO);

doc.roundedRect(MARGIN, 58, 30, 30, 8).fill(AMBER);
doc
  .fillColor(INDIGO)
  .font("Helvetica-Bold")
  .fontSize(10)
  .text("CM", MARGIN, 68, { width: 30, align: "center" });

doc
  .fillColor("#FFFFFF")
  .font("Helvetica-Bold")
  .fontSize(17)
  .text("CASAMOVE", MARGIN + 42, 65, { characterSpacing: 1.8 });

doc
  .fillColor("#FFD88F")
  .font("Helvetica")
  .fontSize(9)
  .text("GUIDE UTILISATEUR", MARGIN, 220, { characterSpacing: 2.4 });

doc
  .fillColor("#FFFFFF")
  .font("Helvetica-Bold")
  .fontSize(34)
  .text("CasaMove,\nmode d'emploi", MARGIN, 244, {
    width: 440,
    lineGap: 4,
  });

doc.rect(MARGIN, 370, 52, 4).fill(AMBER);

doc
  .fillColor("#C4CEDE")
  .font("Helvetica")
  .fontSize(13)
  .text(
    "Réclamations, suivi, contacts, tarifs et informations utiles aux usagers du réseau.",
    MARGIN,
    396,
    { width: 400, lineGap: 4 }
  );

doc
  .fillColor("#8FA0BD")
  .font("Helvetica")
  .fontSize(9)
  .text("Version 1.0 · 21 novembre 2026", MARGIN, PAGE_H - 96);
doc.text("Sources : guide voyageurs 2026 et procédures CasaMove", MARGIN, PAGE_H - 82);
doc.text("Démonstration CasaMove, données de test", MARGIN, PAGE_H - 68);

doc.addPage();

/* ---------- Corps ---------- */

for (const token of tokens) {
  if (token.type === "heading") {
    heading(token.text, token.depth);
    continue;
  }
  if (token.type === "paragraph") {
    paragraph(inlineText(token.tokens ?? []) || token.text);
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
  if (token.type === "space") continue;
  if (token.type === "hr") {
    doc.moveDown(0.6);
    doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor(LINE).stroke();
    doc.moveDown(0.6);
  }
}

/* ---------- Pieds de page ---------- */

const range = doc.bufferedPageRange();
for (let index = 1; index < range.count; index += 1) {
  doc.switchToPage(range.start + index);
  doc
    .fillColor("#8A93A6")
    .font("Helvetica")
    .fontSize(8)
    .text("CasaMove · Guide utilisateur", MARGIN, PAGE_H - 34, {
      width: CONTENT_W / 2,
      lineBreak: false,
    });
  doc.text(String(index + 1), MARGIN + CONTENT_W / 2, PAGE_H - 34, {
    width: CONTENT_W / 2,
    align: "right",
    lineBreak: false,
  });
}

doc.end();
console.log("Guide PDF généré");
