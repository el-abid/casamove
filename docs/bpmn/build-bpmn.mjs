import { writeFileSync } from "node:fs";

const SIZE = {
  user: { w: 130, h: 80 },
  service: { w: 130, h: 80 },
  start: { w: 36, h: 36 },
  end: { w: 36, h: 36 },
  xor: { w: 50, h: 50 },
};

const TAG = {
  user: "bpmn:userTask",
  service: "bpmn:serviceTask",
  start: "bpmn:startEvent",
  end: "bpmn:endEvent",
  xor: "bpmn:exclusiveGateway",
};

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function node(id, name, kind, cx, cy, lane) {
  return { id, name, kind, cx, cy, lane, ...SIZE[kind] };
}

function autoRoute(a, b) {
  const right = a.cx + a.w / 2;
  const left = b.cx - b.w / 2;
  if (left - right > 8) {
    if (Math.abs(a.cy - b.cy) < 2) return [[right, a.cy], [left, b.cy]];
    const mx = Math.min(right + 45, left - 20);
    return [[right, a.cy], [mx, a.cy], [mx, b.cy], [left, b.cy]];
  }
  if (b.cy > a.cy) {
    const sy = a.cy + a.h / 2;
    const ey = b.cy - b.h / 2;
    return [[a.cx, sy], [a.cx, ey], [b.cx, ey]];
  }
  const sy = a.cy - a.h / 2;
  const ey = b.cy + b.h / 2;
  return [[a.cx, sy], [a.cx, ey], [b.cx, ey]];
}

function build(m) {
  const byId = Object.fromEntries(m.nodes.map((n) => [n.id, n]));

  const lanesXml = m.lanes
    .map((l) => {
      const refs = m.nodes
        .filter((n) => n.lane === l.id)
        .map((n) => `      <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`)
        .join("\n");
      return `    <bpmn:lane id="${l.id}" name="${esc(l.name)}">
${refs}
    </bpmn:lane>`;
    })
    .join("\n");

  const nodesXml = m.nodes
    .map((n) => `    <${TAG[n.kind]} id="${n.id}" name="${esc(n.name)}" />`)
    .join("\n");

  const flowsXml = m.flows
    .map((f) => {
      const name = f.name ? ` name="${esc(f.name)}"` : "";
      return `    <bpmn:sequenceFlow id="${f.id}" sourceRef="${f.from}" targetRef="${f.to}"${name} />`;
    })
    .join("\n");

  const annXml = (m.annotations || [])
    .map(
      (a) => `    <bpmn:textAnnotation id="${a.id}">
      <bpmn:text>${esc(a.text)}</bpmn:text>
    </bpmn:textAnnotation>
    <bpmn:association id="${a.id}_assoc" sourceRef="${a.id}" targetRef="${a.target}" />`
    )
    .join("\n");

  const laneShapes = m.lanes
    .map(
      (l) => `      <bpmndi:BPMNShape id="${l.id}_di" bpmnElement="${l.id}" isHorizontal="true">
        <dc:Bounds x="30" y="${l.y}" width="${m.width - 30}" height="${l.h}" />
      </bpmndi:BPMNShape>`
    )
    .join("\n");

  const nodeShapes = m.nodes
    .map(
      (n) => `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">
        <dc:Bounds x="${Math.round(n.cx - n.w / 2)}" y="${Math.round(n.cy - n.h / 2)}" width="${n.w}" height="${n.h}" />
      </bpmndi:BPMNShape>`
    )
    .join("\n");

  const annShapes = (m.annotations || [])
    .map(
      (a) => `      <bpmndi:BPMNShape id="${a.id}_di" bpmnElement="${a.id}">
        <dc:Bounds x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" />
      </bpmndi:BPMNShape>`
    )
    .join("\n");

  const flowEdges = m.flows
    .map((f) => {
      const pts = f.via || autoRoute(byId[f.from], byId[f.to]);
      const wp = pts
        .map((p) => `        <di:waypoint x="${Math.round(p[0])}" y="${Math.round(p[1])}" />`)
        .join("\n");
      const label = f.label
        ? `
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${f.label.x}" y="${f.label.y}" width="${f.label.w}" height="${f.label.h}" />
        </bpmndi:BPMNLabel>`
        : "";
      return `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">
${wp}${label}
      </bpmndi:BPMNEdge>`;
    })
    .join("\n");

  const assocEdges = (m.annotations || [])
    .map((a) => {
      const t = byId[a.target];
      const points = a.association || [
        [a.x + a.w, a.y + a.h / 2],
        [t.cx, t.cy + t.h / 2],
      ];
      const wp = points
        .map((p) => `        <di:waypoint x="${Math.round(p[0])}" y="${Math.round(p[1])}" />`)
        .join("\n");
      return `      <bpmndi:BPMNEdge id="${a.id}_assoc_di" bpmnElement="${a.id}_assoc">
${wp}
      </bpmndi:BPMNEdge>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_${m.key}" targetNamespace="http://casamove.ma/bpmn">
  <bpmn:collaboration id="Collab_${m.key}">
    <bpmn:participant id="Pool_${m.key}" name="${esc(m.pool)}" processRef="Process_${m.key}" />
  </bpmn:collaboration>
  <bpmn:process id="Process_${m.key}" isExecutable="false">
    <bpmn:laneSet id="LaneSet_${m.key}">
${lanesXml}
    </bpmn:laneSet>
${nodesXml}
${flowsXml}
${annXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_${m.key}">
    <bpmndi:BPMNPlane id="Plane_${m.key}" bpmnElement="Collab_${m.key}">
      <bpmndi:BPMNShape id="Pool_${m.key}_di" bpmnElement="Pool_${m.key}" isHorizontal="true">
        <dc:Bounds x="0" y="0" width="${m.width}" height="${m.height}" />
      </bpmndi:BPMNShape>
${laneShapes}
${nodeShapes}
${annShapes}
${flowEdges}
${assocEdges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

/* ------------------------------------------------------------------ */
/* AS-IS                                                               */
/* ------------------------------------------------------------------ */

const asIs = {
  key: "AsIs",
  pool: "Service client actuel (AS-IS)",
  width: 1500,
  height: 650,
  lanes: [
    { id: "Lane_A_Usager", name: "Usager", y: 0, h: 150 },
    { id: "Lane_A_WhatsApp", name: "Assistant WhatsApp", y: 150, h: 150 },
    { id: "Lane_A_Agent", name: "Agent service client", y: 300, h: 150 },
    { id: "Lane_A_Back", name: "Back-office", y: 450, h: 200 },
  ],
  nodes: [
    node("A_Start", "Demande reçue", "start", 140, 75, "Lane_A_Usager"),
    node("A_Contact", "Contacte le service client", "user", 320, 75, "Lane_A_Usager"),
    node("A_Canal", "Canal ?", "xor", 480, 75, "Lane_A_Usager"),
    node("A_Bot", "Bot WhatsApp répond", "service", 640, 225, "Lane_A_WhatsApp"),
    node("A_Suffisant", "Réponse suffisante ?", "xor", 800, 225, "Lane_A_WhatsApp"),
    node("A_Qualifie", "Qualifie la demande", "user", 980, 375, "Lane_A_Agent"),
    node("A_Repond", "Répond sur le canal d'origine", "user", 1160, 375, "Lane_A_Agent"),
    node("A_Form", "Traite le formulaire e-mail", "user", 640, 525, "Lane_A_Back"),
    node("A_Saisit", "Saisit la réclamation", "user", 980, 525, "Lane_A_Back"),
    node("A_Maj", "Met à jour le tableau", "user", 1160, 525, "Lane_A_Back"),
    node("A_EndOk", "Résolu", "end", 1200, 75, "Lane_A_Usager"),
    node("A_EndRep", "Réponse donnée", "end", 1360, 375, "Lane_A_Agent"),
    node("A_EndEnv", "Réponse envoyée", "end", 1360, 525, "Lane_A_Back"),
  ],
  flows: [
    { id: "A_f1", from: "A_Start", to: "A_Contact" },
    { id: "A_f2", from: "A_Contact", to: "A_Canal" },
    {
      id: "A_f3",
      from: "A_Canal",
      to: "A_Bot",
      name: "WhatsApp",
      label: { x: 530, y: 90, w: 78, h: 18 },
      via: [[480, 100], [520, 100], [520, 225], [575, 225]],
    },
    {
      id: "A_f4",
      from: "A_Canal",
      to: "A_Qualifie",
      name: "Téléphone",
      label: { x: 720, y: 330, w: 80, h: 18 },
      via: [[455, 100], [455, 320], [980, 320], [980, 335]],
    },
    {
      id: "A_f5",
      from: "A_Canal",
      to: "A_Form",
      name: "Formulaire",
      label: { x: 488, y: 468, w: 80, h: 18 },
      via: [[505, 100], [505, 525], [575, 525]],
    },
    { id: "A_f6", from: "A_Bot", to: "A_Suffisant" },
    {
      id: "A_f7",
      from: "A_Suffisant",
      to: "A_EndOk",
      name: "oui",
      via: [[800, 200], [800, 75], [1182, 75]],
    },
    {
      id: "A_f8",
      from: "A_Suffisant",
      to: "A_Qualifie",
      name: "non",
      via: [[800, 250], [800, 300], [950, 300], [950, 335]],
    },
    { id: "A_f9", from: "A_Qualifie", to: "A_Repond" },
    { id: "A_f10", from: "A_Repond", to: "A_EndRep" },
    { id: "A_f11", from: "A_Form", to: "A_Saisit" },
    { id: "A_f12", from: "A_Saisit", to: "A_Maj" },
    { id: "A_f13", from: "A_Maj", to: "A_EndEnv" },
  ],
  annotations: [
    {
      id: "A_Ann1",
      text: "Rupture de canal : l'usager doit revenir sur WhatsApp",
      x: 1100,
      y: 170,
      w: 250,
      h: 46,
      target: "A_Repond",
      association: [[1100, 193], [1160, 335]],
    },
    {
      id: "A_Ann2",
      text: "Aucun numéro de dossier, aucun SLA",
      x: 640,
      y: 585,
      w: 240,
      h: 46,
      target: "A_Saisit",
      association: [[880, 608], [980, 565]],
    },
    {
      id: "A_Ann3",
      text: "Suivi manuel, invisible pour l'usager",
      x: 1060,
      y: 585,
      w: 250,
      h: 46,
      target: "A_Maj",
      association: [[1160, 585], [1160, 565]],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* TO-BE                                                               */
/* ------------------------------------------------------------------ */

const toBe = {
  key: "ToBe",
  pool: "Service client augmenté (TO-BE)",
  width: 2060,
  height: 860,
  lanes: [
    { id: "Lane_T_Usager", name: "Usager", y: 0, h: 150 },
    { id: "Lane_T_Site", name: "Site CasaMove", y: 150, h: 150 },
    { id: "Lane_T_Sup", name: "Superviseur LangGraph", y: 300, h: 150 },
    { id: "Lane_T_IA", name: "Agents IA", y: 450, h: 260 },
    { id: "Lane_T_Humain", name: "Agent humain", y: 710, h: 150 },
  ],
  nodes: [
    node("T_Start", "Besoin d'information ou de réclamation", "start", 110, 75, "Lane_T_Usager"),
    node("T_Ouvre", "Ouvre le chat de la page", "user", 280, 75, "Lane_T_Usager"),
    node("T_Site", "Affiche le widget et le flux", "service", 450, 225, "Lane_T_Site"),
    node("T_Class", "Classifie l'intention", "service", 620, 375, "Lane_T_Sup"),
    node("T_Intent", "Intention ?", "xor", 790, 375, "Lane_T_Sup"),
    node("T_Rag", "Recherche RAG et cite les sources", "service", 960, 520, "Lane_T_IA"),
    node("T_Pert", "Pertinence suffisante ?", "xor", 1130, 520, "Lane_T_IA"),
    node("T_Lit", "Lit la réponse et les sources", "user", 1230, 75, "Lane_T_Usager"),
    node("T_Resolu", "Résolu", "end", 1410, 75, "Lane_T_Usager"),
    node("T_TicketP3", "Crée un ticket P3", "service", 1300, 520, "Lane_T_IA"),
    node("T_TicketCree", "Ticket créé", "end", 1410, 520, "Lane_T_IA"),
    node("T_Qualifie", "Qualifie et crée le ticket", "service", 960, 650, "Lane_T_IA"),
    node("T_Sla", "Calcule le SLA", "service", 1130, 650, "Lane_T_IA"),
    node("T_Brouillon", "Prépare le brouillon", "service", 1300, 650, "Lane_T_IA"),
    node("T_Valide", "Valide, édite ou rejette", "user", 1300, 790, "Lane_T_Humain"),
    node("T_Decision", "Décision ?", "xor", 1480, 790, "Lane_T_Humain"),
    node("T_Envoie", "Envoie et journalise", "service", 1660, 790, "Lane_T_Humain"),
    node("T_Recoit", "Reçoit la réponse et le numéro", "user", 1780, 75, "Lane_T_Usager"),
    node("T_Traite", "Traité", "end", 1960, 75, "Lane_T_Usager"),
    node("T_Arbitre", "Arbitre le cas", "user", 1660, 375, "Lane_T_Sup"),
    node("T_Escalade", "Escaladé", "end", 1840, 375, "Lane_T_Sup"),
  ],
  flows: [
    { id: "T_f1", from: "T_Start", to: "T_Ouvre" },
    {
      id: "T_f2",
      from: "T_Ouvre",
      to: "T_Site",
      via: [[345, 75], [385, 75], [385, 225]],
    },
    {
      id: "T_f3",
      from: "T_Site",
      to: "T_Class",
      via: [[515, 225], [535, 225], [535, 375], [555, 375]],
    },
    { id: "T_f4", from: "T_Class", to: "T_Intent" },
    {
      id: "T_f5",
      from: "T_Intent",
      to: "T_Rag",
      name: "Information",
      label: { x: 825, y: 455, w: 82, h: 18 },
      via: [[815, 375], [850, 375], [850, 520], [895, 520]],
    },
    {
      id: "T_f6",
      from: "T_Intent",
      to: "T_Qualifie",
      name: "Réclamation",
      label: { x: 735, y: 560, w: 82, h: 18 },
      via: [[790, 400], [790, 650], [895, 650]],
    },
    { id: "T_f7", from: "T_Rag", to: "T_Pert" },
    {
      id: "T_f8",
      from: "T_Pert",
      to: "T_Lit",
      name: "oui",
      via: [[1130, 495], [1130, 75], [1165, 75]],
    },
    { id: "T_f9", from: "T_Pert", to: "T_TicketP3", name: "non" },
    { id: "T_f10", from: "T_TicketP3", to: "T_TicketCree" },
    { id: "T_f11", from: "T_Qualifie", to: "T_Sla" },
    { id: "T_f12", from: "T_Sla", to: "T_Brouillon" },
    {
      id: "T_f13",
      from: "T_Brouillon",
      to: "T_Valide",
      via: [[1300, 690], [1300, 750]],
    },
    { id: "T_f14", from: "T_Valide", to: "T_Decision" },
    { id: "T_f15", from: "T_Decision", to: "T_Envoie", name: "approuvé" },
    {
      id: "T_f16",
      from: "T_Decision",
      to: "T_Arbitre",
      name: "rejeté",
      label: { x: 1470, y: 560, w: 70, h: 18 },
      via: [[1480, 765], [1480, 375], [1595, 375]],
    },
    { id: "T_f17", from: "T_Arbitre", to: "T_Escalade" },
    {
      id: "T_f18",
      from: "T_Envoie",
      to: "T_Recoit",
      via: [[1725, 790], [1780, 790], [1780, 115]],
    },
    { id: "T_f19", from: "T_Recoit", to: "T_Traite" },
    { id: "T_f20", from: "T_Lit", to: "T_Resolu" },
  ],
  annotations: [
    {
      id: "T_Ann1",
      text: "Chaque étape écrit le journal d'audit",
      x: 520,
      y: 470,
      w: 210,
      h: 46,
      target: "T_Class",
      association: [[625, 470], [620, 415]],
    },
    {
      id: "T_Ann2",
      text: "Aucun envoi sans décision humaine",
      x: 1020,
      y: 760,
      w: 210,
      h: 46,
      target: "T_Valide",
      association: [[1230, 783], [1235, 790]],
    },
  ],
};

writeFileSync(new URL("./as-is.bpmn", import.meta.url), build(asIs), "utf8");
writeFileSync(new URL("./to-be.bpmn", import.meta.url), build(toBe), "utf8");
console.log("as-is.bpmn et to-be.bpmn générés");

