import { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import ChatThread from "../components/ChatThread";
import useChat from "../components/useChat";
import theme from "../components/theme";

const SECTIONS = [
  { id: "inventor",    label: "Inventor Info",   icon: "①" },
  { id: "agreement",  label: "Our Vision",       icon: "②" },
  { id: "title",      label: "Title & Field",    icon: "③" },
  { id: "description",label: "Description",      icon: "④" },
  { id: "claims",     label: "Claims",           icon: "⑤" },
  { id: "review",     label: "Filing Package",   icon: "★" },
];

const PROJECTS_KEY = "haiic_pf_projects";
const HANDOFF_KEY  = "haiic_pf_handoff";

function loadProjects() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]"); }
  catch { return []; }
}
function saveProjects(projects) {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); }
  catch { console.warn("localStorage unavailable"); }
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function updateProject(projects, id, patch) {
  return projects.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p);
}

// ─── Export (.docx) ───────────────────────────────────────────────────────────

async function exportToDocx(project) {
  const { name, data, section } = project;
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Header, Footer, PageNumber, TabStopType, TabStopPosition } = await import("docx");
  const RED = "C0392B", GRAY = "666666", BLACK = "1A1A1A";
  const spacer = (sz = 160) => new Paragraph({ children: [new TextRun("")], spacing: { after: sz } });
  const sectionHeading = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } }, children: [new TextRun({ text, color: RED, bold: true, font: "Arial", size: 26 })] });
  const bodyText = (text, options = {}) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, font: "Arial", size: 20, color: GRAY, ...options })] });
  const labelValue = (label, value) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${label}  `, bold: true, font: "Arial", size: 20, color: BLACK }), new TextRun({ text: value || "—", font: "Arial", size: 20, color: GRAY })] });
  const renderDiscussion = (raw) => {
    if (!raw) return [];
    return raw.split("\n").flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("[SYSTEM:")) return [];
      const isAssistant = trimmed.startsWith("assistant:"), isUser = trimmed.startsWith("user:");
      const roleLabel = isAssistant ? "AI Assistant" : isUser ? "Inventor" : null;
      const body = roleLabel ? trimmed.slice(trimmed.indexOf(":") + 1).trim() : trimmed;
      return [new Paragraph({ spacing: { after: 60 }, children: [...(roleLabel ? [new TextRun({ text: `${roleLabel}:  `, bold: true, color: isAssistant ? RED : BLACK, font: "Arial", size: 20 })] : []), new TextRun({ text: body, font: "Arial", size: 20, color: GRAY })] })];
    });
  };
  const children = [];
  children.push(
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 40 }, children: [new TextRun({ text: "HUMAN-AI INNOVATION COMMONS", font: "Arial", size: 18, bold: true, color: RED, allCaps: true })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 80 }, children: [new TextRun({ text: data.patentTitle || name || "Provisional Patent Application", font: "Arial", size: 40, bold: true, color: BLACK })] }),
    labelValue("Inventor:", data.inventorName),
    labelValue("Location:", [data.city, data.state, data.country].filter(Boolean).join(", ")),
    labelValue("Date:", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })),
    labelValue("Stage:", SECTIONS[section]?.label || "Complete"),
    spacer(320),
  );
  children.push(
    sectionHeading("Our Shared Vision"), spacer(80),
    bodyText("HAIIC was built on the belief that when AI helps create something valuable, the wealth it generates should flow back to the people AI affects most. Patent Forge is free because democratizing invention is the right thing to do — no fine print, no hidden fees, no claiming ownership of your idea."),
    spacer(80),
    bodyText("We're not asking inventors to sign a contract. We're inviting them into a vision. The model we live by — and hope inspires others — distributes the value of AI-assisted innovation equally: one third to the inventor who brought the expertise and lived experience; one third to programs supporting workers displaced by AI; and one third to AI safety research so that AI keeps working for everyone."),
    spacer(80),
    bodyText("This is our compass, not a clause. The invention belongs to its inventor. But if it succeeds, we hope they'll remember where the idea started — and consider paying it forward.", { italics: true, color: "888888" }),
    spacer(80),
    labelValue("Inventor:", data.inventorName || "—"),
    labelValue("Date:", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })),
    spacer(160),
  );
  if (data.patentTitle || data.patentField || data.summary) {
    children.push(sectionHeading("Title & Field of Invention"), spacer(80));
    if (data.patentTitle) children.push(labelValue("Title:", data.patentTitle));
    if (data.patentField) children.push(labelValue("Field:", data.patentField));
    if (data.summary) children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Summary:", bold: true, font: "Arial", size: 20, color: BLACK })] }), bodyText(data.summary));
    children.push(spacer(160));
  }
  if (data.noveltyAssessment) {
    children.push(sectionHeading("Novelty & Patentability Assessment"), spacer(80), ...data.noveltyAssessment.split("\n").map(line => new Paragraph({ spacing: { after: line.trim() === "" ? 100 : 60 }, children: [new TextRun({ text: line, font: "Arial", size: 20, color: GRAY })] })), spacer(160));
  }
  if (data.descriptionDiscussion) children.push(sectionHeading("Detailed Description — Working Session"), spacer(80), ...renderDiscussion(data.descriptionDiscussion), spacer(160));
  if (data.claimsDiscussion) children.push(sectionHeading("Patent Claims — Working Session"), spacer(80), ...renderDiscussion(data.claimsDiscussion), spacer(160));
  if (data.filingDocument) {
    children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }), new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "PROVISIONAL PATENT APPLICATION", font: "Arial", size: 28, bold: true, color: BLACK, allCaps: true })] }), new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: "Human-AI Innovation Commons", font: "Arial", size: 20, color: GRAY, italics: true })] }), spacer(80),
      ...data.filingDocument.split("\n").map((line) => {
        const trimmed = line.trim();
        const isHeading = /^[A-Z][A-Z\s]{4,}$/.test(trimmed) && trimmed.length < 60;
        return new Paragraph({ spacing: { after: trimmed === "" ? 120 : 60 }, ...(isHeading ? { heading: HeadingLevel.HEADING_2 } : {}), children: [new TextRun({ text: line, font: "Arial", size: isHeading ? 22 : 20, bold: isHeading, color: isHeading ? RED : GRAY })] });
      }),
    );
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } }, paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 40, bold: true, font: "Arial", color: BLACK }, paragraph: { spacing: { before: 0, after: 160 }, outlineLevel: 0 } }, { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: "Arial", color: RED }, paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 1 } }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } }, children: [new TextRun({ text: "HAIIC Patent Forge", font: "Arial", size: 18, color: RED, bold: true }), new TextRun({ text: "\tapps-haiic.com", font: "Arial", size: 18, color: GRAY })] })] }) }, footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], children: [new TextRun({ text: "Human-AI Innovation Commons  ·  Co-authored with Claude", font: "Arial", size: 16, color: GRAY }), new TextRun({ children: ["\t", PageNumber.CURRENT], font: "Arial", size: 16, color: GRAY })] })] }) }, children }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
  a.download = `HAIIC-PatentForge-${(data.patentTitle || name || "patent").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.docx`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Novelty Advisor ──────────────────────────────────────────────────────────

function NoveltyAdvisor({ data, context, onSave }) {
  const [open,       setOpen]       = useState(false);
  const [assessment, setAssessment] = useState(data.noveltyAssessment || null);
  const [loading,    setLoading]    = useState(false);
  const [followUp,   setFollowUp]   = useState("");
  const [thread,     setThread]     = useState(data.noveltyThread || []);

  const systemPrompt = `You are a knowledgeable friend who has been through the patent process and understands innovation well. Your job is to give inventors an honest, plain-English read on how novel and patentable their idea might be — and concrete suggestions to make it stronger.

Tone: honest but genuinely encouraging. The first idea is rarely the best — your job is to help them find the angle that makes it stronger, not to stop them. Always end on what's possible.

Structure every assessment exactly like this — use these exact emoji headers:

🔍 THE HONEST READ
One paragraph. What's genuinely interesting here, and what's the main novelty challenge as you see it.

✅ WHAT'S WORKING
2-3 specific things that strengthen the novelty case. Be concrete — name the actual feature or aspect.

⚠️ WATCH OUT FOR
1-2 areas where prior art might be an issue. Plain English only, no legal jargon.

💡 HOW TO STRENGTHEN IT
2-3 concrete, specific suggestions. Tell them exactly what to add, change, or narrow. Make it actionable.

Close with this line exactly: "Remember: the first idea is rarely the best — every refinement gets you closer. This is a starting point, not a verdict. A registered patent attorney can run a full prior art search before you file."`;

  const runAssessment = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: systemPrompt, messages: [{ role: "user", content: `Please assess the novelty and patentability of this invention:\n\n${context}` }], max_tokens: 900 }) });
      const result = await res.json();
      const text = result.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Unable to generate assessment. Please try again.";
      setAssessment(text); const newThread = [{ role: "assistant", content: text }]; setThread(newThread);
      onSave({ noveltyAssessment: text, noveltyThread: newThread });
    } catch { setAssessment("Unable to generate assessment. Please try again."); }
    finally { setLoading(false); }
  };

  const askFollowUp = async () => {
    if (!followUp.trim() || loading) return;
    const userMsg = { role: "user", content: followUp }; const newThread = [...thread, userMsg];
    setThread(newThread); setFollowUp(""); setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: systemPrompt, messages: [{ role: "user", content: `Invention context:\n\n${context}` }, ...newThread], max_tokens: 600 }) });
      const result = await res.json();
      const text = result.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Unable to respond.";
      const updated = [...newThread, { role: "assistant", content: text }]; setThread(updated);
      onSave({ noveltyAssessment: assessment, noveltyThread: updated });
    } catch {} finally { setLoading(false); }
  };

  return (
    <div style={na.wrap}>
      <button onClick={() => setOpen(o => !o)} style={na.toggle}>
        🔬 Novelty Advisor &nbsp;{open ? "▲" : "▼"}
        {assessment && <span style={na.badge}>✓ Assessment ready</span>}
      </button>
      {open && (
        <div style={na.panel}>
          <p style={na.intro}>Get an honest read on how patentable your invention is right now — and exactly what to do to make it stronger. Think of this as a knowledgeable friend giving you their real opinion, not a lawyer reviewing a contract.</p>
          {!assessment && !loading && <button onClick={runAssessment} style={na.runBtn}>Check Novelty & Patentability →</button>}
          {loading && <p style={na.loadingMsg}>Analyzing your invention…</p>}
          {assessment && (
            <>
              <div style={na.result}><pre style={na.resultText}>{thread[0]?.content || assessment}</pre></div>
              {thread.length > 1 && (
                <div style={na.threadWrap}>
                  {thread.slice(1).map((m, i) => (
                    <div key={i} style={{ ...na.msg, background: m.role === "user" ? "transparent" : theme.surfaceAlt }}>
                      <span style={{ ...na.msgRole, color: m.role === "assistant" ? theme.red : theme.text }}>{m.role === "assistant" ? "Advisor" : "You"}:{"  "}</span>
                      <span style={na.msgText}>{m.content}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={na.followRow}>
                <input style={na.followInput} value={followUp} onChange={e => setFollowUp(e.target.value)} onKeyDown={e => e.key === "Enter" && askFollowUp()} placeholder="Ask a follow-up — what if I changed this? How does this compare to X?" disabled={loading} />
                <button onClick={askFollowUp} disabled={loading || !followUp.trim()} style={na.askBtn}>Ask →</button>
              </div>
              <button onClick={runAssessment} style={na.rerunBtn}>↻ Re-run with latest changes</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Session Toolbar ──────────────────────────────────────────────────────────

function SessionToolbar({ project, onSave, onExport, onDashboard }) {
  const [saved, setSaved] = useState(false);
  const handleSave = () => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div style={tb.bar}>
      <button onClick={onDashboard} style={tb.dashBtn}>← Projects</button>
      <div style={tb.projectName}>{project?.name || "Untitled Patent"}</div>
      <div style={tb.actions}>
        <button onClick={handleSave} style={{ ...tb.btn, color: saved ? "#4ade80" : theme.textMuted }}>{saved ? "✓ Saved" : "💾 Save Draft"}</button>
        <button onClick={onExport} style={tb.btn}>⬇ Export .docx</button>
      </div>
    </div>
  );
}

// ─── Project Dashboard ────────────────────────────────────────────────────────

function ProjectDashboard({ onNew, onResume }) {
  const [projects, setProjects] = useState([]);
  const [newName,  setNewName]  = useState("");
  const [handoff,  setHandoff]  = useState(null);

  useEffect(() => {
    setProjects(loadProjects());
    try {
      const h = localStorage.getItem(HANDOFF_KEY);
      if (h) setHandoff(JSON.parse(h));
    } catch {}
  }, []);

  const handleHandoff = () => {
    if (!handoff) return;
    const project = {
      id: genId(),
      name: handoff.name || "Brainstorm Import",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      section: 0,
      data: {
        patentTitle:       handoff.patentTitle  || "",
        patentField:       handoff.patentField  || handoff.field || "",
        summary:           handoff.inventionBrief ? handoff.inventionBrief.substring(0, 400) : "",
        brainstormBrief:   handoff.inventionBrief || "",
        noveltyAssessment: handoff.noveltyAssessment || null,
        fromBrainstorm:    true,
      },
    };
    const updated = [project, ...projects];
    saveProjects(updated);
    try { localStorage.removeItem(HANDOFF_KEY); } catch {}
    setHandoff(null);
    onNew(project);
  };

  const dismissHandoff = () => {
    try { localStorage.removeItem(HANDOFF_KEY); } catch {}
    setHandoff(null);
  };

  const handleNew = () => {
    const name = newName.trim() || `Patent Application — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const project = { id: genId(), name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), section: 0, data: {} };
    const updated = [project, ...projects]; saveProjects(updated); onNew(project);
  };
  const handleDelete = (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const updated = projects.filter(p => p.id !== id); saveProjects(updated); setProjects(updated);
  };
  const handleRename = (id) => {
    const p = projects.find(p => p.id === id); const n = prompt("Rename project:", p.name); if (!n?.trim()) return;
    const updated = updateProject(projects, id, { name: n.trim() }); saveProjects(updated); setProjects(updated);
  };
  const sectionLabel = (i) => i >= SECTIONS.length - 1 ? "Complete ★" : SECTIONS[i]?.label || "?";

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Patent Applications</h2>
      <p style={ps.desc}>Each application saves your full session — resume any time, at any stage.</p>

      {/* Handoff banner */}
      {handoff && (
        <div style={hf.banner}>
          <div style={hf.bannerLeft}>
            <div style={hf.bannerTitle}>🔗 Brainstorm session ready to continue</div>
            <div style={hf.bannerMeta}>"{handoff.name}" — carry your work straight into Patent Forge with the title, field, and Invention Brief pre-filled.</div>
          </div>
          <div style={hf.bannerRight}>
            <button onClick={handleHandoff} style={hf.continueBtn}>Continue in Patent Forge →</button>
            <button onClick={dismissHandoff} style={hf.dismissBtn}>Dismiss</button>
          </div>
        </div>
      )}

      <div style={db.newRow}>
        <input style={{ ...ps.input, flex: 1, marginTop: 0 }} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleNew()} placeholder="Name your invention (optional)..." />
        <button onClick={handleNew} style={ps.nextBtn}>Start New Application →</button>
      </div>

      {projects.length > 0 && (
        <div style={db.list}>
          <p style={db.listHeader}>SAVED APPLICATIONS ({projects.length})</p>
          {projects.map(p => (
            <div key={p.id} style={db.card}>
              <div style={db.cardLeft}>
                <div style={db.cardName}>{p.name}{p.data?.fromBrainstorm && <span style={hf.tag}>from Brainstorm</span>}</div>
                <div style={db.cardMeta}>Last saved {new Date(p.updatedAt).toLocaleString()} &nbsp;·&nbsp; Stage: <span style={{ color: theme.red }}>{sectionLabel(p.section)}</span></div>
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
      {projects.length === 0 && !handoff && <div style={db.empty}>No saved applications yet. Start your first one above.</div>}
    </div>
  );
}

// ─── Section Components ───────────────────────────────────────────────────────

function InventorSection({ data, setData, onNext }) {
  const [name, setName] = useState(data.inventorName || "");
  const [city, setCity] = useState(data.city || "");
  const [state, setState] = useState(data.state || "");
  const [country, setCountry] = useState(data.country || "United States");
  const [email, setEmail] = useState(data.email || "");
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
      {data.fromBrainstorm && (
        <div style={hf.infoBar}>💡 Your Brainstorm session has been pre-loaded — title, field, and brief are ready in the next steps.</div>
      )}
      <button onClick={() => { setData({ ...data, inventorName: name, city, state, country, email }); onNext(); }} disabled={!canProceed} style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed" }}>Next: Our Vision →</button>
    </div>
  );
}

function AgreementSection({ data, setData, onNext }) {
  const [agreed, setAgreed] = useState(data.agreed || false);
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Our Shared Vision</h2>
      <p style={ps.desc}>Before we go further, we want to share what HAIIC is about — and what we hope this tool means for you and for the world.</p>
      <div style={ps.agreementCard}>
        <h3 style={ps.agreementTitle}>Why We Built This</h3>
        <p style={ps.agreementText}>AI is changing everything — including who gets to benefit from innovation. HAIIC exists because we believe that breakthrough ideas don't belong only to corporations and venture capital. They belong to people like you: teachers, tradespeople, healthcare workers, farmers, and anyone else who has spent years solving real problems in the real world.</p>
        <p style={ps.agreementText}>Patent Forge is free because we believe democratizing invention is the right thing to do. No fine print. No hidden fees. No claiming ownership of your idea.</p>
        <h3 style={{ ...ps.agreementTitle, marginTop: 20 }}>What We Hope For</h3>
        <p style={ps.agreementText}>We're not asking you to sign a contract. We're inviting you into a vision. HAIIC was founded on the belief that when AI helps create something valuable, the wealth it generates should flow back to the people AI affects most. Here's the model we live by — and that we hope inspires you:</p>
        <div style={ps.splits}>
          <div style={ps.split}><div style={ps.splitPct}>33⅓%</div><div style={ps.splitLabel}>The Inventor</div><p style={ps.splitDesc}>You brought the expertise, the insight, and the lived experience. That deserves to be rewarded.</p></div>
          <div style={ps.split}><div style={ps.splitPct}>33⅓%</div><div style={ps.splitLabel}>Displaced Workers</div><p style={ps.splitDesc}>AI is reshaping the workforce. We believe those most affected deserve a share of what it creates.</p></div>
          <div style={ps.split}><div style={ps.splitPct}>33⅓%</div><div style={ps.splitLabel}>AI Safety Research</div><p style={ps.splitDesc}>So that AI keeps working for everyone — not just those who own it.</p></div>
        </div>
        <p style={ps.agreementNote}>This is our compass, not a clause. You're not obligated to follow this model — your invention is yours. But if it succeeds, we hope you'll remember where the idea started, and consider paying it forward.</p>
      </div>
      <label style={ps.checkboxLabel}>
        <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setData({ ...data, agreed: e.target.checked }); }} style={ps.checkbox} />
        I've read HAIIC's vision and I'm ready to move forward. I understand this is not a legal obligation — it's an invitation to be part of something better.
      </label>
      <button onClick={onNext} disabled={!agreed} style={{ ...ps.nextBtn, opacity: agreed ? 1 : 0.4, cursor: agreed ? "pointer" : "not-allowed" }}>I'm In — Next: Title & Field →</button>
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
      {data.brainstormBrief && (
        <div style={hf.infoBar}>
          💡 Your Invention Brief from Brainstorm is saved — the AI will use it as context throughout. Review and refine the title and summary below if needed.
        </div>
      )}
      <label style={ps.label}>Invention Title</label>
      <input style={ps.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Self-Adjusting Ergonomic Assembly Fixture" />
      <p style={ps.hint}>Descriptive but concise. Think "what it is" not "what it's called."</p>
      <label style={ps.label}>Technical Field</label>
      <input style={ps.input} value={field} onChange={e => setField(e.target.value)} placeholder="e.g., Manufacturing Equipment, Medical Devices, Educational Technology..." />
      <label style={ps.label}>Brief Summary (2-3 sentences)</label>
      <textarea style={ps.textarea} value={summary} onChange={e => setSummary(e.target.value)} placeholder="What does your invention do? What problem does it solve? What makes it different?" rows={4} />
      <button onClick={() => { setData({ ...data, patentTitle: title, patentField: field, summary }); onNext(); }} disabled={!canProceed} style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed" }}>Next: Detailed Description →</button>
    </div>
  );
}

function DescriptionSection({ data, setData, onNext }) {
  const brainstormContext = data.brainstormBrief ? `\nInvention Brief from Brainstorm session:\n${data.brainstormBrief.substring(0, 1200)}` : "";
  const systemPrompt = `You are a patent drafting assistant at HAIIC (Human-AI Innovation Commons), helping an inventor write the Detailed Description section of a provisional patent application.\nInvention: ${data.patentTitle}\nField: ${data.patentField}\nSummary: ${data.summary}\nInventor: ${data.inventorName}${brainstormContext}\nYOUR TASK: Guide the inventor through writing a thorough technical description.\n- Ask about the key components or steps of the invention\n- For each component, ask: what is it, what does it do, how does it connect to other parts?\n- Ask about materials, dimensions, configurations where relevant\n- Ask about alternative embodiments — could parts be swapped or modified?\n- Push for the level of detail that would let someone "skilled in the art" reproduce the invention\n- Be encouraging — remind them that their practical knowledge IS the technical expertise needed\n- After 4-5 exchanges, offer to compile what you've discussed into a structured description\n- Keep responses to 2-3 paragraphs max`;
  const chat = useChat(systemPrompt);
  const initialized = useRef(false);
  useEffect(() => { if (!initialized.current && chat.messages.length === 0) { initialized.current = true; chat.send(`[SYSTEM: Start by acknowledging the invention "${data.patentTitle}" and ask the inventor to walk you through how it works, starting with the main components or steps.]`); } }, []);
  const proceed = () => { setData({ ...data, descriptionDiscussion: chat.messages.map(m => `${m.role}: ${m.content}`).join("\n") }); onNext(); };
  const noveltyContext = `Title: ${data.patentTitle || "—"}\nField: ${data.patentField || "—"}\nSummary: ${data.summary || "—"}\nDescription so far: ${(data.descriptionDiscussion || "").substring(0, 1200)}`;
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Detailed Description</h2>
      <p style={ps.desc}>This is the heart of your patent. The AI will help you describe your invention in enough detail that someone in your field could reproduce it.</p>
      <ChatThread messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))} loading={chat.loading} onSend={msg => chat.send(msg)} placeholder="Describe how your invention works..." />
      {chat.messages.length > 5 && (
        <>
          <button onClick={proceed} style={ps.nextBtn}>Next: Draft Claims →</button>
          <NoveltyAdvisor data={data} context={noveltyContext} onSave={(updates) => setData({ ...data, ...updates })} />
        </>
      )}
    </div>
  );
}

function ClaimsSection({ data, setData, onNext }) {
  const systemPrompt = `You are a patent claims drafting assistant at HAIIC. You're helping an inventor draft patent claims for their provisional application.\nInvention: ${data.patentTitle}\nField: ${data.patentField}\nSummary: ${data.summary}\nDescription discussion: ${(data.descriptionDiscussion || "").substring(0, 3000)}\nYOUR TASK: Help draft patent claims.\n- Explain that claims define the legal boundaries of what the patent protects\n- Start with a broad independent claim that captures the core invention\n- Then suggest 2-3 dependent claims that narrow to specific features\n- Use proper claim language: "comprising," "wherein," "configured to"\n- Ask the inventor to confirm each claim captures what they intend\n- Explain the tradeoff: broader claims = wider protection but easier to challenge\n- Keep it accessible — translate patent language into plain English alongside each claim\n- After drafting claims, ask if there are features they want to make sure are protected`;
  const chat = useChat(systemPrompt);
  const initialized = useRef(false);
  useEffect(() => { if (!initialized.current && chat.messages.length === 0) { initialized.current = true; chat.send(`[SYSTEM: Explain what patent claims are in simple terms, then draft a broad independent claim for "${data.patentTitle}" based on the description. Present it in both patent language and plain English.]`); } }, []);
  const proceed = () => { setData({ ...data, claimsDiscussion: chat.messages.map(m => `${m.role}: ${m.content}`).join("\n") }); onNext(); };
  const noveltyContext = `Title: ${data.patentTitle || "—"}\nField: ${data.patentField || "—"}\nSummary: ${data.summary || "—"}\nDescription: ${(data.descriptionDiscussion || "").substring(0, 800)}\nClaims drafted: ${(data.claimsDiscussion || "").substring(0, 800)}`;
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Draft Patent Claims</h2>
      <p style={ps.desc}>Claims define exactly what your patent protects. The AI will help you draft them in proper legal language while explaining everything in plain English.</p>
      <ChatThread messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))} loading={chat.loading} onSend={msg => chat.send(msg)} placeholder="Review the claims and let me know what to adjust..." />
      {chat.messages.length > 4 && (
        <>
          <button onClick={proceed} style={ps.nextBtn}>Generate Filing Package →</button>
          <NoveltyAdvisor data={data} context={noveltyContext} onSave={(updates) => setData({ ...data, ...updates })} />
        </>
      )}
    </div>
  );
}

function ReviewSection({ data, setData }) {
  const [document, setDocument] = useState(data.filingDocument || "");
  const [loading,  setLoading]  = useState(!data.filingDocument);
  const [copied,   setCopied]   = useState(false);
  useEffect(() => { if (!data.filingDocument) generateDocument(); }, []);

  const generateDocument = async () => {
    setLoading(true);
    try {
      const brainstormContext = data.brainstormBrief ? `\nInvention Brief from prior Brainstorm session:\n${data.brainstormBrief.substring(0, 1000)}` : "";
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are generating a complete provisional patent application document for the USPTO. Format it as a professional filing document with proper sections. Include:\n\n1. HEADER with: "PROVISIONAL PATENT APPLICATION" title, inventor name, city, state, country, date\n2. HAIIC BENEFIT-SHARING ACKNOWLEDGMENT: "The undersigned inventor(s) agree that upon issuance of any non-provisional patent derived from this application, commercialization rights shall be administered under the HAIIC Benefit-Sharing Framework, with revenue distributed equally among (1) the inventor(s), (2) programs supporting workers displaced by AI automation, and (3) AI safety and alignment research."\n3. TITLE OF THE INVENTION\n4. FIELD OF THE INVENTION\n5. BACKGROUND OF THE INVENTION (synthesize from discussions)\n6. SUMMARY OF THE INVENTION\n7. DETAILED DESCRIPTION OF THE PREFERRED EMBODIMENT (comprehensive, from description discussion)\n8. CLAIMS (properly formatted patent claims from claims discussion)\n9. ABSTRACT (150-word summary)\n\nWrite in formal patent language. Be thorough and specific. This should read like a real provisional patent application.`,
          messages: [{ role: "user", content: `Generate the complete provisional patent application:\n\nInventor: ${data.inventorName}\nCity: ${data.city}, ${data.state}, ${data.country}\nTitle: ${data.patentTitle}\nField: ${data.patentField}\nSummary: ${data.summary}${brainstormContext}\n\nDescription Discussion:\n${(data.descriptionDiscussion || "").substring(0, 3000)}\n\nClaims Discussion:\n${(data.claimsDiscussion || "").substring(0, 3000)}` }],
          max_tokens: 4000,
        }),
      });
      const result = await response.json();
      const text = result.content?.map(i => i.type === "text" ? i.text : "").join("\n");
      const finalDoc = text || "Unable to generate document. Please try again.";
      setDocument(finalDoc); setData(prev => ({ ...prev, filingDocument: finalDoc }));
    } catch { setDocument("Unable to generate document. Please try again."); }
    finally { setLoading(false); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(document); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Filing Package</h2>
      <p style={ps.desc}>Here's your complete provisional patent application. Review it carefully, then export or copy it for filing with the USPTO.</p>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
          <p>Generating your provisional patent application…</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>This may take a moment — we're compiling everything into a complete filing document.</p>
        </div>
      ) : (
        <>
          <div style={ps.docCard}><pre style={ps.docText}>{document}</pre></div>
          <div style={ps.docActions}><button onClick={handleCopy} style={ps.copyBtn}>{copied ? "✓ Copied!" : "Copy to Clipboard"}</button></div>
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
  const [view, setView] = useState("dashboard");
  const [project, setProject] = useState(null);
  const [section, setSection] = useState(0);
  const [data, setData] = useState({});

  useEffect(() => {
    if (!project) return;
    saveProjects(updateProject(loadProjects(), project.id, { section, data }));
  }, [section, data]);

  const handleSetData = (newData) => setData(newData);
  const goNext = () => setSection(s => Math.min(s + 1, SECTIONS.length - 1));
  const goToSection = (t) => { if (t < section) setSection(t); };
  const handleNew = (proj) => { setProject(proj); setSection(proj.section || 0); setData(proj.data || {}); setView("session"); };
  const handleResume = (proj) => { setProject(proj); setSection(proj.section || 0); setData(proj.data || {}); setView("session"); };
  const handleDashboard = () => {
    if (project) saveProjects(updateProject(loadProjects(), project.id, { section, data }));
    setView("dashboard"); setProject(null); setSection(0); setData({});
  };
  const handleSave = () => { if (project) saveProjects(updateProject(loadProjects(), project.id, { section, data })); };
  const handleExport = () => { if (project) exportToDocx({ ...project, section, data }); };

  if (view === "dashboard") {
    return (
      <Layout title="Patent Forge" logoSrc="/patentforge-logo.png">
        <div style={styles.header}><p style={styles.label}>PATENT FORGE</p><h1 style={styles.heading}>Draft Your Provisional Patent</h1></div>
        <ProjectDashboard onNew={handleNew} onResume={handleResume} />
      </Layout>
    );
  }

  return (
    <Layout title="Patent Forge" logoSrc="/patentforge-logo.png">
      <div style={styles.header}><p style={styles.label}>PATENT FORGE</p><h1 style={styles.heading}>Draft Your Provisional Patent</h1></div>
      <SessionToolbar project={project} onSave={handleSave} onExport={handleExport} onDashboard={handleDashboard} />
      <div style={styles.sections}>
        {SECTIONS.map((s, i) => {
          const isActive = i === section, isCompleted = i < section;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div onClick={() => isCompleted && goToSection(i)} title={isCompleted ? `Return to ${s.label}` : undefined} style={{ ...styles.sectionChip, background: isActive ? theme.red : isCompleted ? theme.surfaceAlt : "transparent", borderColor: isActive || isCompleted ? theme.red : theme.border, color: isActive ? "#fff" : isCompleted ? theme.textMuted : theme.textDim, cursor: isCompleted ? "pointer" : "default" }}>
                {isCompleted && <span style={{ marginRight: 3, fontSize: 9 }}>✓</span>}{s.icon} {s.label}
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
  label: { color: theme.red, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 },
  heading: { fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: theme.text },
  sections: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 32, paddingBottom: 20, borderBottom: `1px solid ${theme.border}` },
  sectionChip: { border: "1px solid", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s ease" },
};

const ps = {
  content:  { marginTop: 8 },
  title:    { fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: theme.text, marginBottom: 12 },
  desc:     { fontSize: 15, lineHeight: 1.7, color: theme.textMuted, marginBottom: 16 },
  label:    { display: "block", fontSize: 13, fontWeight: 600, color: theme.textMuted, marginBottom: 6, marginTop: 16 },
  hint:     { fontSize: 12, color: theme.textDim, marginTop: 4 },
  input:    { width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" },
  nextBtn:  { background: theme.red, border: "none", borderRadius: 8, color: "#fff", padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 16, whiteSpace: "nowrap" },
  agreementCard: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 28, marginBottom: 24 },
  agreementTitle: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 12 },
  agreementText: { fontSize: 14, lineHeight: 1.7, color: theme.textMuted, marginBottom: 16 },
  agreementNote: { fontSize: 12, lineHeight: 1.6, color: theme.textDim, fontStyle: "italic", borderTop: `1px solid ${theme.border}`, paddingTop: 12, marginTop: 8 },
  splits:     { display: "flex", gap: 20, margin: "20px 0", flexWrap: "wrap" },
  split:      { flex: 1, textAlign: "center", minWidth: 120 },
  splitPct:   { fontSize: 28, fontWeight: 700, color: theme.red, marginBottom: 6 },
  splitLabel: { fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 },
  splitDesc:  { fontSize: 12, color: theme.textMuted, lineHeight: 1.5 },
  checkboxLabel: { display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, lineHeight: 1.6, color: theme.text, cursor: "pointer", marginBottom: 8 },
  checkbox: { marginTop: 4, accentColor: theme.red },
  docCard: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24, marginBottom: 20, maxHeight: 500, overflowY: "auto" },
  docText: { fontSize: 13, lineHeight: 1.7, color: "#ccc", fontFamily: "'DM Sans', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  docActions: { display: "flex", gap: 12, marginBottom: 24 },
  copyBtn: { padding: "12px 20px", background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textMuted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  nextSteps: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24 },
  nextStepsTitle: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 12 },
  nextStepsText: { fontSize: 14, lineHeight: 1.7, color: theme.textMuted, marginBottom: 8 },
};

const db = {
  newRow:     { display: "flex", gap: 12, marginBottom: 32, alignItems: "center", flexWrap: "wrap" },
  list:       { display: "flex", flexDirection: "column", gap: 10 },
  listHeader: { fontSize: 11, fontWeight: 700, letterSpacing: 2, color: theme.textDim, textTransform: "uppercase", marginBottom: 4 },
  card:       { display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "14px 18px", gap: 12, flexWrap: "wrap" },
  cardLeft:   { flex: 1, minWidth: 200 },
  cardName:   { fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 4 },
  cardMeta:   { fontSize: 12, color: theme.textDim },
  cardRight:  { display: "flex", gap: 8, alignItems: "center" },
  resumeBtn:  { background: theme.red, border: "none", borderRadius: 7, color: "#fff", padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  iconBtn:    { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 7, color: theme.textMuted, padding: "7px 10px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  empty:      { textAlign: "center", padding: "40px 20px", color: theme.textDim, fontSize: 14, border: `1px dashed ${theme.border}`, borderRadius: 10 },
};

const tb = {
  bar:         { display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, marginBottom: 20, flexWrap: "wrap" },
  dashBtn:     { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  projectName: { flex: 1, fontSize: 13, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  actions:     { display: "flex", gap: 8 },
  btn:         { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s" },
};

const na = {
  wrap:        { marginTop: 24, borderTop: `1px solid ${theme.border}`, paddingTop: 16 },
  toggle:      { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textMuted, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 8 },
  badge:       { background: theme.red, color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700 },
  panel:       { marginTop: 12, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 20 },
  intro:       { fontSize: 13, color: theme.textMuted, lineHeight: 1.6, marginBottom: 16 },
  runBtn:      { background: theme.red, border: "none", borderRadius: 7, color: "#fff", padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  loadingMsg:  { color: theme.textMuted, fontSize: 13, fontStyle: "italic" },
  result:      { background: theme.surfaceAlt, borderRadius: 8, padding: 16, marginBottom: 16 },
  resultText:  { fontSize: 13, lineHeight: 1.7, color: theme.text, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'DM Sans', sans-serif", margin: 0 },
  threadWrap:  { marginBottom: 12 },
  msg:         { padding: "8px 12px", borderRadius: 6, marginBottom: 6 },
  msgRole:     { fontSize: 12, fontWeight: 700, marginRight: 6 },
  msgText:     { fontSize: 13, color: theme.textMuted, lineHeight: 1.6 },
  followRow:   { display: "flex", gap: 8, marginBottom: 8 },
  followInput: { flex: 1, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 7, color: theme.text, padding: "8px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" },
  askBtn:      { background: theme.red, border: "none", borderRadius: 7, color: "#fff", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  rerunBtn:    { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textDim, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};

const hf = {
  banner:      { display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.surface, border: `1px solid ${theme.red}`, borderRadius: 10, padding: "16px 20px", marginBottom: 24, gap: 16, flexWrap: "wrap" },
  bannerLeft:  { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 4 },
  bannerMeta:  { fontSize: 13, color: theme.textMuted, lineHeight: 1.5 },
  bannerRight: { display: "flex", gap: 8, alignItems: "center" },
  continueBtn: { background: theme.red, border: "none", borderRadius: 7, color: "#fff", padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" },
  dismissBtn:  { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 7, color: theme.textMuted, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  infoBar:     { background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: theme.textMuted, marginBottom: 16, lineHeight: 1.5 },
  tag:         { marginLeft: 8, background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "1px 6px", fontSize: 10, color: theme.textDim, fontWeight: 600 },
};
