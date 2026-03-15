import { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import ChatThread from "../components/ChatThread";
import useChat from "../components/useChat";
import theme from "../components/theme";

// ─── Section Definitions ──────────────────────────────────────────────────────

const SECTIONS = [
  { id: "inventor",     label: "Inventor Info",             icon: "①" },
  { id: "agreement",    label: "Benefit-Sharing",           icon: "②" },
  { id: "title",        label: "Title & Field",             icon: "③" },
  { id: "description",  label: "Description",               icon: "④" },
  { id: "claims",       label: "Claims",                    icon: "⑤" },
  { id: "review",       label: "Filing Package",            icon: "★" },
];

// ─── localStorage Helpers ─────────────────────────────────────────────────────

const PROJECTS_KEY = "haiic_pf_projects";

function loadProjects() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]"); }
  catch { return []; }
}

function saveProjects(projects) {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); }
  catch { console.warn("localStorage unavailable"); }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function updateProject(projects, id, patch) {
  return projects.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p);
}

// ─── Export to .docx ──────────────────────────────────────────────────────────

async function exportToDocx(project) {
  const { name, data, section } = project;

  const {
    Document, Packer, Paragraph, TextRun,
    HeadingLevel, AlignmentType, BorderStyle,
    Header, Footer, PageNumber, TabStopType, TabStopPosition,
  } = await import("docx");

  const RED   = "C0392B";
  const GRAY  = "666666";
  const BLACK = "1A1A1A";
  const LGRAY = "999999";

  const spacer = (sz = 160) => new Paragraph({ children: [new TextRun("")], spacing: { after: sz } });

  const sectionHeading = (text) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } },
    children: [new TextRun({ text, color: RED, bold: true, font: "Arial", size: 26 })],
  });

  const bodyText = (text, options = {}) => new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 20, color: GRAY, ...options })],
  });

  const labelValue = (label, value) => new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}  `, bold: true, font: "Arial", size: 20, color: BLACK }),
      new TextRun({ text: value || "—", font: "Arial", size: 20, color: GRAY }),
    ],
  });

  const renderDiscussion = (raw) => {
    if (!raw) return [];
    return raw.split("\n").flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("[SYSTEM:")) return [];
      const isAssistant = trimmed.startsWith("assistant:");
      const isUser      = trimmed.startsWith("user:");
      const roleLabel   = isAssistant ? "AI Assistant" : isUser ? "Inventor" : null;
      const body        = roleLabel ? trimmed.slice(trimmed.indexOf(":") + 1).trim() : trimmed;
      return [new Paragraph({
        spacing: { after: 60 },
        children: [
          ...(roleLabel ? [new TextRun({
            text: `${roleLabel}:  `,
            bold: true,
            color: isAssistant ? RED : BLACK,
            font: "Arial",
            size: 20,
          })] : []),
          new TextRun({ text: body, font: "Arial", size: 20, color: GRAY }),
        ],
      })];
    });
  };

  const children = [];

  // ── Cover ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({
        text: "HUMAN-AI INNOVATION COMMONS",
        font: "Arial", size: 18, bold: true, color: RED, allCaps: true,
      })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 80 },
      children: [new TextRun({
        text: data.patentTitle || name || "Provisional Patent Application",
        font: "Arial", size: 40, bold: true, color: BLACK,
      })],
    }),
    labelValue("Inventor:", data.inventorName),
    labelValue("Location:", [data.city, data.state, data.country].filter(Boolean).join(", ")),
    labelValue("Date:", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })),
    labelValue("Stage:", SECTIONS[section]?.label || "Complete"),
    spacer(320),
  );

  // ── Benefit-Sharing Acknowledgment ─────────────────────────────────────────
  children.push(
    sectionHeading("HAIIC Benefit-Sharing Acknowledgment"),
    spacer(80),
    bodyText(
      `The undersigned inventor agrees that upon issuance of any non-provisional patent derived from this application, commercialization rights shall be administered under the HAIIC Benefit-Sharing Framework, with revenue distributed equally among (1) the inventor, (2) programs supporting workers displaced by AI automation, and (3) AI safety and alignment research.`
    ),
    spacer(80),
    labelValue("Inventor:", data.inventorName || "—"),
    labelValue("Date acknowledged:", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })),
    spacer(160),
  );

  // ── Title & Field ──────────────────────────────────────────────────────────
  if (data.patentTitle || data.patentField || data.summary) {
    children.push(sectionHeading("Title & Field of Invention"), spacer(80));
    if (data.patentTitle)  children.push(labelValue("Title:", data.patentTitle));
    if (data.patentField)  children.push(labelValue("Field:", data.patentField));
    if (data.summary) {
      children.push(
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Summary:", bold: true, font: "Arial", size: 20, color: BLACK })] }),
        bodyText(data.summary),
      );
    }
    children.push(spacer(160));
  }

  // ── Description Discussion ─────────────────────────────────────────────────
  if (data.descriptionDiscussion) {
    children.push(
      sectionHeading("Detailed Description — Working Session"),
      spacer(80),
      ...renderDiscussion(data.descriptionDiscussion),
      spacer(160),
    );
  }

  // ── Claims Discussion ──────────────────────────────────────────────────────
  if (data.claimsDiscussion) {
    children.push(
      sectionHeading("Patent Claims — Working Session"),
      spacer(80),
      ...renderDiscussion(data.claimsDiscussion),
      spacer(160),
    );
  }

  // ── Full Filing Document ───────────────────────────────────────────────────
  if (data.filingDocument) {
    children.push(
      new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: "PROVISIONAL PATENT APPLICATION", font: "Arial", size: 28, bold: true, color: BLACK, allCaps: true })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: "Human-AI Innovation Commons", font: "Arial", size: 20, color: GRAY, italics: true })],
      }),
      spacer(80),
      ...data.filingDocument.split("\n").map((line) => {
        const trimmed = line.trim();
        const isHeading = /^[A-Z][A-Z\s]{4,}$/.test(trimmed) && trimmed.length < 60;
        return new Paragraph({
          spacing: { after: trimmed === "" ? 120 : 60 },
          ...(isHeading ? { heading: HeadingLevel.HEADING_2 } : {}),
          children: [new TextRun({
            text: line,
            font: "Arial",
            size: isHeading ? 22 : 20,
            bold: isHeading,
            color: isHeading ? RED : GRAY,
          })],
        });
      }),
    );
  }

  // ── Build doc ──────────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 40, bold: true, font: "Arial", color: BLACK },
          paragraph: { spacing: { before: 0, after: 160 }, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, font: "Arial", color: RED },
          paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } },
            children: [
              new TextRun({ text: "HAIIC Patent Forge", font: "Arial", size: 18, color: RED, bold: true }),
              new TextRun({ text: "\tapps-haiic.com", font: "Arial", size: 18, color: GRAY }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: "Human-AI Innovation Commons  ·  Co-authored with Claude", font: "Arial", size: 16, color: GRAY }),
              new TextRun({ children: ["\t", PageNumber.CURRENT], font: "Arial", size: 16, color: GRAY }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  const slug = (data.patentTitle || name || "patent").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  a.download = `HAIIC-PatentForge-${slug}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Session Toolbar ──────────────────────────────────────────────────────────

function SessionToolbar({ project, onSave, onExport, onDashboard }) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={tb.bar}>
      <button onClick={onDashboard} style={tb.dashBtn}>← Projects</button>
      <div style={tb.projectName}>{project?.name || "Untitled Patent"}</div>
      <div style={tb.actions}>
        <button onClick={handleSave} style={{ ...tb.btn, color: saved ? "#4ade80" : theme.textMuted }}>
          {saved ? "✓ Saved" : "💾 Save Draft"}
        </button>
        <button onClick={onExport} style={tb.btn}>⬇ Export .docx</button>
      </div>
    </div>
  );
}

// ─── Project Dashboard ────────────────────────────────────────────────────────

function ProjectDashboard({ onNew, onResume }) {
  const [projects, setProjects] = useState([]);
  const [newName,  setNewName]  = useState("");

  useEffect(() => { setProjects(loadProjects()); }, []);

  const handleNew = () => {
    const name = newName.trim() || `Patent Application — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const project = {
      id: genId(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      section: 0,
      data: {},
    };
    const updated = [project, ...projects];
    saveProjects(updated);
    onNew(project);
  };

  const handleDelete = (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const updated = projects.filter(p => p.id !== id);
    saveProjects(updated);
    setProjects(updated);
  };

  const handleRename = (id) => {
    const p = projects.find(p => p.id === id);
    const newName = prompt("Rename project:", p.name);
    if (!newName?.trim()) return;
    const updated = updateProject(projects, id, { name: newName.trim() });
    saveProjects(updated);
    setProjects(updated);
  };

  const sectionLabel = (i) => i >= SECTIONS.length - 1 ? "Complete ★" : SECTIONS[i]?.label || "?";

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Patent Applications</h2>
      <p style={ps.desc}>
        Each application saves your full session — resume any time, at any stage.
      </p>

      <div style={db.newRow}>
        <input
          style={{ ...ps.input, flex: 1, marginTop: 0 }}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleNew()}
          placeholder="Name your invention (optional)..."
        />
        <button onClick={handleNew} style={ps.nextBtn}>
          Start New Application →
        </button>
      </div>

      {projects.length > 0 && (
        <div style={db.list}>
          <p style={db.listHeader}>SAVED APPLICATIONS ({projects.length})</p>
          {projects.map(p => (
            <div key={p.id} style={db.card}>
              <div style={db.cardLeft}>
                <div style={db.cardName}>{p.name}</div>
                <div style={db.cardMeta}>
                  Last saved {new Date(p.updatedAt).toLocaleString()} &nbsp;·&nbsp;
                  Stage: <span style={{ color: theme.red }}>{sectionLabel(p.section)}</span>
                </div>
              </div>
              <div style={db.cardRight}>
                <button onClick={() => onResume(p)} style={db.resumeBtn}>Resume →</button>
                <button onClick={() => handleRename(p.id)} style={db.iconBtn} title="Rename">✏</button>
                <button onClick={() => handleDelete(p.id, p.name)} style={db.iconBtn} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {projects.length === 0 && (
        <div style={db.empty}>No saved applications yet. Start your first one above.</div>
      )}
    </div>
  );
}

// ─── Section Components ───────────────────────────────────────────────────────

function InventorSection({ data, setData, onNext }) {
  const [name,    setName]    = useState(data.inventorName || "");
  const [city,    setCity]    = useState(data.city         || "");
  const [state,   setState]   = useState(data.state        || "");
  const [country, setCountry] = useState(data.country      || "United States");
  const [email,   setEmail]   = useState(data.email        || "");

  const canProceed = name.trim() && city.trim() && state.trim();

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Inventor Information</h2>
      <p style={ps.desc}>This is who will be named on the provisional patent application.</p>

      <label style={ps.label}>Full Legal Name</label>
      <input style={ps.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Jane M. Smith" />

      <label style={ps.label}>City</label>
      <input style={ps.input} value={city} onChange={e => setCity(e.target.value)} placeholder="e.g., Decatur" />

      <label style={ps.label}>State / Province</label>
      <input style={ps.input} value={state} onChange={e => setState(e.target.value)} placeholder="e.g., Georgia" />

      <label style={ps.label}>Country</label>
      <input style={ps.input} value={country} onChange={e => setCountry(e.target.value)} />

      <label style={ps.label}>Email (optional)</label>
      <input style={ps.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="For filing correspondence" />

      <button
        onClick={() => { setData({ ...data, inventorName: name, city, state, country, email }); onNext(); }}
        disabled={!canProceed}
        style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed" }}
      >
        Next: Benefit-Sharing Agreement →
      </button>
    </div>
  );
}

function AgreementSection({ data, setData, onNext }) {
  const [agreed, setAgreed] = useState(data.agreed || false);

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>HAIIC Benefit-Sharing Agreement</h2>
      <p style={ps.desc}>
        Every patent created through HAIIC's tools enters our irrevocable three-way benefit-sharing
        framework. Please review and acknowledge the terms below.
      </p>

      <div style={ps.agreementCard}>
        <h3 style={ps.agreementTitle}>Benefit-Sharing Framework</h3>
        <p style={ps.agreementText}>
          Upon issuance of any non-provisional patent derived from this application,
          commercialization rights shall be administered under the HAIIC Benefit-Sharing Framework:
        </p>
        <div style={ps.splits}>
          <div style={ps.split}>
            <div style={ps.splitPct}>33⅓%</div>
            <div style={ps.splitLabel}>To the Inventor</div>
            <p style={ps.splitDesc}>You, {data.inventorName || "the inventor"}, retain one-third of all licensing revenue</p>
          </div>
          <div style={ps.split}>
            <div style={ps.splitPct}>33⅓%</div>
            <div style={ps.splitLabel}>Displaced Workers</div>
            <p style={ps.splitDesc}>Programs supporting workers affected by AI automation</p>
          </div>
          <div style={ps.split}>
            <div style={ps.splitPct}>33⅓%</div>
            <div style={ps.splitLabel}>AI Safety Research</div>
            <p style={ps.splitDesc}>Research ensuring AI development benefits everyone</p>
          </div>
        </div>
        <p style={ps.agreementText}>
          This framework is embedded in HAIIC's founding documents with structural protections
          that prevent any future board from modifying or dissolving it.
        </p>
        <p style={ps.agreementNote}>
          Note: This acknowledgment documents your intent to participate in the HAIIC Benefit-Sharing
          Framework. Formal assignment will be executed upon patent issuance with the assistance of
          legal counsel.
        </p>
      </div>

      <label style={ps.checkboxLabel}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => { setAgreed(e.target.checked); setData({ ...data, agreed: e.target.checked }); }}
          style={ps.checkbox}
        />
        I, {data.inventorName || "[inventor name]"}, acknowledge the HAIIC Benefit-Sharing Framework
        and agree that upon issuance of any non-provisional patent derived from this application,
        commercialization rights shall be administered under this framework.
      </label>

      <button
        onClick={onNext}
        disabled={!agreed}
        style={{ ...ps.nextBtn, opacity: agreed ? 1 : 0.4, cursor: agreed ? "pointer" : "not-allowed" }}
      >
        I Agree — Next: Title & Field →
      </button>
    </div>
  );
}

function TitleSection({ data, setData, onNext }) {
  const [title,   setTitle]   = useState(data.patentTitle || "");
  const [field,   setField]   = useState(data.patentField || "");
  const [summary, setSummary] = useState(data.summary     || "");

  const canProceed = title.trim() && field.trim() && summary.trim();

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Title & Field of Invention</h2>
      <p style={ps.desc}>Name your invention and describe it at a high level. Don't worry about perfection — the AI will help you refine.</p>

      <label style={ps.label}>Invention Title</label>
      <input style={ps.input} value={title} onChange={e => setTitle(e.target.value)}
        placeholder="e.g., Self-Adjusting Ergonomic Assembly Fixture" />
      <p style={ps.hint}>Descriptive but concise. Think "what it is" not "what it's called."</p>

      <label style={ps.label}>Technical Field</label>
      <input style={ps.input} value={field} onChange={e => setField(e.target.value)}
        placeholder="e.g., Manufacturing Equipment, Medical Devices, Educational Technology..." />

      <label style={ps.label}>Brief Summary (2-3 sentences)</label>
      <textarea style={ps.textarea} value={summary} onChange={e => setSummary(e.target.value)}
        placeholder="What does your invention do? What problem does it solve? What makes it different?"
        rows={4} />

      <button
        onClick={() => { setData({ ...data, patentTitle: title, patentField: field, summary }); onNext(); }}
        disabled={!canProceed}
        style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed" }}
      >
        Next: Detailed Description →
      </button>
    </div>
  );
}

function DescriptionSection({ data, setData, onNext }) {
  const systemPrompt = `You are a patent drafting assistant at HAIIC (Human-AI Innovation Commons), helping an inventor write the Detailed Description section of a provisional patent application.

Invention: ${data.patentTitle}
Field: ${data.patentField}
Summary: ${data.summary}
Inventor: ${data.inventorName}

YOUR TASK: Guide the inventor through writing a thorough technical description.
- Ask about the key components or steps of the invention
- For each component, ask: what is it, what does it do, how does it connect to other parts?
- Ask about materials, dimensions, configurations where relevant
- Ask about alternative embodiments — could parts be swapped or modified?
- Push for the level of detail that would let someone "skilled in the art" reproduce the invention
- Be encouraging — remind them that their practical knowledge IS the technical expertise needed
- After 4-5 exchanges, offer to compile what you've discussed into a structured description
- Keep responses to 2-3 paragraphs max`;

  const chat = useChat(systemPrompt);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && chat.messages.length === 0) {
      initialized.current = true;
      chat.send(`[SYSTEM: Start by acknowledging the invention "${data.patentTitle}" and ask the inventor to walk you through how it works, starting with the main components or steps.]`);
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    setData({ ...data, descriptionDiscussion: allMsgs });
    onNext();
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Detailed Description</h2>
      <p style={ps.desc}>This is the heart of your patent. The AI will help you describe your invention in enough detail that someone in your field could reproduce it.</p>
      <ChatThread
        messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))}
        loading={chat.loading}
        onSend={msg => chat.send(msg)}
        placeholder="Describe how your invention works..."
      />
      {chat.messages.length > 5 && (
        <button onClick={proceed} style={ps.nextBtn}>Next: Draft Claims →</button>
      )}
    </div>
  );
}

function ClaimsSection({ data, setData, onNext }) {
  const systemPrompt = `You are a patent claims drafting assistant at HAIIC. You're helping an inventor draft patent claims for their provisional application.

Invention: ${data.patentTitle}
Field: ${data.patentField}
Summary: ${data.summary}
Description discussion: ${(data.descriptionDiscussion || "").substring(0, 3000)}

YOUR TASK: Help draft patent claims.
- Explain that claims define the legal boundaries of what the patent protects
- Start with a broad independent claim that captures the core invention
- Then suggest 2-3 dependent claims that narrow to specific features
- Use proper claim language: "comprising," "wherein," "configured to"
- Ask the inventor to confirm each claim captures what they intend
- Explain the tradeoff: broader claims = wider protection but easier to challenge
- Keep it accessible — translate patent language into plain English alongside each claim
- After drafting claims, ask if there are features they want to make sure are protected`;

  const chat = useChat(systemPrompt);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && chat.messages.length === 0) {
      initialized.current = true;
      chat.send(`[SYSTEM: Explain what patent claims are in simple terms, then draft a broad independent claim for "${data.patentTitle}" based on the description. Present it in both patent language and plain English.]`);
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    setData({ ...data, claimsDiscussion: allMsgs });
    onNext();
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Draft Patent Claims</h2>
      <p style={ps.desc}>Claims define exactly what your patent protects. The AI will help you draft them in proper legal language while explaining everything in plain English.</p>
      <ChatThread
        messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))}
        loading={chat.loading}
        onSend={msg => chat.send(msg)}
        placeholder="Review the claims and let me know what to adjust..."
      />
      {chat.messages.length > 4 && (
        <button onClick={proceed} style={ps.nextBtn}>Generate Filing Package →</button>
      )}
    </div>
  );
}

function ReviewSection({ data, setData }) {
  const [document, setDocument] = useState(data.filingDocument || "");
  const [loading,  setLoading]  = useState(!data.filingDocument);
  const [copied,   setCopied]   = useState(false);

  useEffect(() => {
    if (!data.filingDocument) generateDocument();
  }, []);

  const generateDocument = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are generating a complete provisional patent application document for the USPTO. Format it as a professional filing document with proper sections. Include:

1. HEADER with: "PROVISIONAL PATENT APPLICATION" title, inventor name, city, state, country, date
2. HAIIC BENEFIT-SHARING ACKNOWLEDGMENT: "The undersigned inventor(s) agree that upon issuance of any non-provisional patent derived from this application, commercialization rights shall be administered under the HAIIC Benefit-Sharing Framework, with revenue distributed equally among (1) the inventor(s), (2) programs supporting workers displaced by AI automation, and (3) AI safety and alignment research."
3. TITLE OF THE INVENTION
4. FIELD OF THE INVENTION
5. BACKGROUND OF THE INVENTION (synthesize from discussions)
6. SUMMARY OF THE INVENTION
7. DETAILED DESCRIPTION OF THE PREFERRED EMBODIMENT (comprehensive, from description discussion)
8. CLAIMS (properly formatted patent claims from claims discussion)
9. ABSTRACT (150-word summary)

Write in formal patent language. Be thorough and specific. This should read like a real provisional patent application.`,
          messages: [{
            role: "user",
            content: `Generate the complete provisional patent application:\n\nInventor: ${data.inventorName}\nCity: ${data.city}, ${data.state}, ${data.country}\nTitle: ${data.patentTitle}\nField: ${data.patentField}\nSummary: ${data.summary}\n\nDescription Discussion:\n${(data.descriptionDiscussion || "").substring(0, 3000)}\n\nClaims Discussion:\n${(data.claimsDiscussion || "").substring(0, 3000)}`,
          }],
          max_tokens: 4000,
        }),
      });
      const result = await response.json();
      const text = result.content?.map(item => item.type === "text" ? item.text : "").join("\n");
      const finalDoc = text || "Unable to generate document. Please try again.";
      setDocument(finalDoc);
      setData(prev => ({ ...prev, filingDocument: finalDoc }));
    } catch {
      setDocument("Unable to generate document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(document);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Filing Package</h2>
      <p style={ps.desc}>
        Here's your complete provisional patent application. Review it carefully, then export
        or copy it for filing with the USPTO.
      </p>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
          <p>Generating your provisional patent application…</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>This may take a moment — we're compiling everything into a complete filing document.</p>
        </div>
      ) : (
        <>
          <div style={ps.docCard}>
            <pre style={ps.docText}>{document}</pre>
          </div>
          <div style={ps.docActions}>
            <button onClick={handleCopy} style={ps.copyBtn}>
              {copied ? "✓ Copied!" : "Copy to Clipboard"}
            </button>
          </div>
          <div style={ps.nextSteps}>
            <h3 style={ps.nextStepsTitle}>Next Steps</h3>
            <p style={ps.nextStepsText}>1. Review the document carefully for accuracy.</p>
            <p style={ps.nextStepsText}>2. File at the USPTO via EFS-Web (www.uspto.gov). Filing fee for a micro entity is approximately $80.</p>
            <p style={ps.nextStepsText}>3. Your provisional patent gives you 12 months of "patent pending" status while you pursue a non-provisional filing.</p>
            <p style={ps.nextStepsText}>4. HAIIC will assist with commercialization and licensing under the benefit-sharing framework.</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PatentForgePage() {
  const [view,    setView]    = useState("dashboard");
  const [project, setProject] = useState(null);
  const [section, setSection] = useState(0);
  const [data,    setData]    = useState({});

  // ── Auto-save on every section or data change ─────────────────────────────
  useEffect(() => {
    if (!project) return;
    const projects = loadProjects();
    const updated  = updateProject(projects, project.id, { section, data });
    saveProjects(updated);
  }, [section, data]);

  const handleSetData = (newData) => setData(newData);

  const goNext = () => setSection(s => Math.min(s + 1, SECTIONS.length - 1));

  const goToSection = (target) => {
    if (target < section) setSection(target);
  };

  const handleNew = (proj) => {
    setProject(proj);
    setSection(proj.section || 0);
    setData(proj.data || {});
    setView("session");
  };

  const handleResume = (proj) => {
    setProject(proj);
    setSection(proj.section || 0);
    setData(proj.data || {});
    setView("session");
  };

  const handleDashboard = () => {
    if (project) {
      const projects = loadProjects();
      const updated  = updateProject(projects, project.id, { section, data });
      saveProjects(updated);
    }
    setView("dashboard");
    setProject(null);
    setSection(0);
    setData({});
  };

  const handleSave = () => {
    if (!project) return;
    const projects = loadProjects();
    const updated  = updateProject(projects, project.id, { section, data });
    saveProjects(updated);
  };

  const handleExport = () => {
    if (!project) return;
    exportToDocx({ ...project, section, data });
  };

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (view === "dashboard") {
    return (
      <Layout title="Patent Forge" logoSrc="/patentforge-logo.png">
        <div style={styles.header}>
          <p style={styles.label}>PATENT FORGE</p>
          <h1 style={styles.heading}>Draft Your Provisional Patent</h1>
        </div>
        <ProjectDashboard onNew={handleNew} onResume={handleResume} />
      </Layout>
    );
  }

  // ── Session ───────────────────────────────────────────────────────────────
  return (
    <Layout title="Patent Forge" logoSrc="/patentforge-logo.png">
      <div style={styles.header}>
        <p style={styles.label}>PATENT FORGE</p>
        <h1 style={styles.heading}>Draft Your Provisional Patent</h1>
      </div>

      <SessionToolbar
        project={project}
        onSave={handleSave}
        onExport={handleExport}
        onDashboard={handleDashboard}
      />

      {/* Breadcrumbs */}
      <div style={styles.sections}>
        {SECTIONS.map((s, i) => {
          const isActive    = i === section;
          const isCompleted = i < section;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                onClick={() => isCompleted && goToSection(i)}
                title={isCompleted ? `Return to ${s.label}` : undefined}
                style={{
                  ...styles.sectionChip,
                  background:  isActive    ? theme.red
                             : isCompleted ? theme.surfaceAlt
                             : "transparent",
                  borderColor: isActive || isCompleted ? theme.red : theme.border,
                  color:       isActive    ? "#fff"
                             : isCompleted ? theme.textMuted
                             : theme.textDim,
                  cursor:      isCompleted ? "pointer" : "default",
                }}
              >
                {isCompleted && <span style={{ marginRight: 3, fontSize: 9 }}>✓</span>}
                {s.icon} {s.label}
              </div>
              {i < SECTIONS.length - 1 && <span style={{ color: theme.textDim, fontSize: 10 }}>›</span>}
            </div>
          );
        })}
      </div>

      {section === 0 && <InventorSection    data={data} setData={handleSetData} onNext={goNext} />}
      {section === 1 && <AgreementSection   data={data} setData={handleSetData} onNext={goNext} />}
      {section === 2 && <TitleSection       data={data} setData={handleSetData} onNext={goNext} />}
      {section === 3 && <DescriptionSection data={data} setData={handleSetData} onNext={goNext} />}
      {section === 4 && <ClaimsSection      data={data} setData={handleSetData} onNext={goNext} />}
      {section === 5 && <ReviewSection      data={data} setData={handleSetData} />}
    </Layout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  header: { marginBottom: 24 },
  label: {
    color: theme.red,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heading: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 32,
    fontWeight: 700,
    color: theme.text,
  },
  sections: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 32,
    paddingBottom: 20,
    borderBottom: `1px solid ${theme.border}`,
  },
  sectionChip: {
    border: "1px solid",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  },
};

const ps = {
  content:  { marginTop: 8 },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 24,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 12,
  },
  desc:     { fontSize: 15, lineHeight: 1.7, color: theme.textMuted, marginBottom: 16 },
  label:    { display: "block", fontSize: 13, fontWeight: 600, color: theme.textMuted, marginBottom: 6, marginTop: 16 },
  hint:     { fontSize: 12, color: theme.textDim, marginTop: 4 },
  input: {
    width: "100%",
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    color: theme.text,
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    color: theme.text,
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
  },
  nextBtn: {
    background: theme.red,
    border: "none",
    borderRadius: 8,
    color: "#fff",
    padding: "12px 24px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    marginTop: 16,
    whiteSpace: "nowrap",
  },
  agreementCard: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 28,
    marginBottom: 24,
  },
  agreementTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 12,
  },
  agreementText: { fontSize: 14, lineHeight: 1.7, color: theme.textMuted, marginBottom: 16 },
  agreementNote: {
    fontSize: 12,
    lineHeight: 1.6,
    color: theme.textDim,
    fontStyle: "italic",
    borderTop: `1px solid ${theme.border}`,
    paddingTop: 12,
    marginTop: 8,
  },
  splits:     { display: "flex", gap: 20, margin: "20px 0", flexWrap: "wrap" },
  split:      { flex: 1, textAlign: "center", minWidth: 120 },
  splitPct:   { fontSize: 28, fontWeight: 700, color: theme.red, marginBottom: 6 },
  splitLabel: { fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 },
  splitDesc:  { fontSize: 12, color: theme.textMuted, lineHeight: 1.5 },
  checkboxLabel: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    fontSize: 14,
    lineHeight: 1.6,
    color: theme.text,
    cursor: "pointer",
    marginBottom: 8,
  },
  checkbox: { marginTop: 4, accentColor: theme.red },
  docCard: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    maxHeight: 500,
    overflowY: "auto",
  },
  docText: {
    fontSize: 13,
    lineHeight: 1.7,
    color: "#ccc",
    fontFamily: "'DM Sans', monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  docActions: { display: "flex", gap: 12, marginBottom: 24 },
  copyBtn: {
    padding: "12px 20px",
    background: theme.surfaceAlt,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  nextSteps: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 24,
  },
  nextStepsTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 12,
  },
  nextStepsText: { fontSize: 14, lineHeight: 1.7, color: theme.textMuted, marginBottom: 8 },
};

const db = {
  newRow: {
    display: "flex",
    gap: 12,
    marginBottom: 32,
    alignItems: "center",
    flexWrap: "wrap",
  },
  list:       { display: "flex", flexDirection: "column", gap: 10 },
  listHeader: { fontSize: 11, fontWeight: 700, letterSpacing: 2, color: theme.textDim, textTransform: "uppercase", marginBottom: 4 },
  card: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    padding: "14px 18px",
    gap: 12,
    flexWrap: "wrap",
  },
  cardLeft:   { flex: 1, minWidth: 200 },
  cardName:   { fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 4 },
  cardMeta:   { fontSize: 12, color: theme.textDim },
  cardRight:  { display: "flex", gap: 8, alignItems: "center" },
  resumeBtn: {
    background: theme.red,
    border: "none",
    borderRadius: 7,
    color: "#fff",
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  iconBtn: {
    background: "transparent",
    border: `1px solid ${theme.border}`,
    borderRadius: 7,
    color: theme.textMuted,
    padding: "7px 10px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  empty: {
    textAlign: "center",
    padding: "40px 20px",
    color: theme.textDim,
    fontSize: 14,
    border: `1px dashed ${theme.border}`,
    borderRadius: 10,
  },
};

const tb = {
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  dashBtn: {
    background: "transparent",
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    color: theme.textMuted,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  projectName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    color: theme.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  actions: { display: "flex", gap: 8 },
  btn: {
    background: "transparent",
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    color: theme.textMuted,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "color 0.2s",
  },
};
