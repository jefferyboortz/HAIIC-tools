import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import ChatThread from "../components/ChatThread";
import useChat from "../components/useChat";
import theme from "../components/theme";
import { supabase } from "../lib/supabase";

const PHASES = [
  { id: "welcome",  label: "Welcome",         icon: "💡" },
  { id: "domain",   label: "Your Expertise",  icon: "①" },
  { id: "problem",  label: "Define Problem",  icon: "②" },
  { id: "deepen",   label: "Explore",         icon: "③" },
  { id: "ideate",   label: "Brainstorm",      icon: "④" },
  { id: "refine",   label: "Refine",          icon: "⑤" },
  { id: "summary",  label: "Invention Brief", icon: "★" },
];

const HANDOFF_KEY = "haiic_pf_handoff";
const TABLE       = "brainstorm_projects";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ─── Export (.docx) ───────────────────────────────────────────────────────────

async function exportToDocx(project) {
  const { name, data, phase } = project;
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Header, Footer, PageNumber, TabStopType, TabStopPosition } = await import("docx");
  const RED = "C0392B", GRAY = "666666", BLACK = "1A1A1A";
  const spacer = () => new Paragraph({ children: [new TextRun("")], spacing: { after: 80 } });
  const sectionHeading = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } }, children: [new TextRun({ text, color: RED, bold: true, font: "Arial", size: 26 })] });
  const renderDiscussion = (raw) => {
    if (!raw) return [];
    return raw.split("\n").flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("[SYSTEM:")) return [];
      const isAssistant = trimmed.startsWith("assistant:"), isUser = trimmed.startsWith("user:");
      const roleLabel = isAssistant ? "AI Coach" : isUser ? "You" : null;
      const body = roleLabel ? trimmed.slice(trimmed.indexOf(":") + 1).trim() : trimmed;
      return [new Paragraph({ spacing: { after: 60 }, children: [...(roleLabel ? [new TextRun({ text: `${roleLabel}:  `, bold: true, color: isAssistant ? RED : BLACK, font: "Arial", size: 20 })] : []), new TextRun({ text: body, font: "Arial", size: 20, color: GRAY })] })];
    });
  };
  const children = [];
  children.push(
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 40 }, children: [new TextRun({ text: "HUMAN-AI INNOVATION COMMONS", font: "Arial", size: 18, bold: true, color: RED, allCaps: true })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 80 }, children: [new TextRun({ text: name || "Invention Session", font: "Arial", size: 40, bold: true, color: BLACK })] }),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `Brainstorm Session  ·  Exported ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, font: "Arial", size: 20, color: GRAY })] }),
    new Paragraph({ spacing: { after: 320 }, children: [new TextRun({ text: `Progress: ${PHASES[phase]?.label || "Complete"}`, font: "Arial", size: 20, color: GRAY, italics: true })] }),
  );
  if (data.field || data.role || data.insight) {
    children.push(sectionHeading("Your Expertise"), spacer());
    if (data.field)   children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Field / Industry:  ", bold: true, font: "Arial", size: 20, color: BLACK }), new TextRun({ text: data.field, font: "Arial", size: 20, color: GRAY })] }));
    if (data.role)    children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Role / Specialty:  ", bold: true, font: "Arial", size: 20, color: BLACK }), new TextRun({ text: data.role, font: "Arial", size: 20, color: GRAY })] }));
    if (data.insight) children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Insider Knowledge:", bold: true, font: "Arial", size: 20, color: BLACK })] }), new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: data.insight, font: "Arial", size: 20, color: GRAY })] }));
  }
  [{ key: "problemDiscussion", label: "Define the Problem" }, { key: "deepenDiscussion", label: "Explore the Problem" }, { key: "ideationDiscussion", label: "Brainstorm Solutions" }, { key: "refineDiscussion", label: "Refine Your Invention" }].forEach(({ key, label }) => {
    if (!data[key]) return;
    children.push(sectionHeading(label), spacer(), ...renderDiscussion(data[key]), spacer());
  });
  if (data.noveltyAssessment) children.push(sectionHeading("Novelty & Patentability Assessment"), spacer(), ...data.noveltyAssessment.split("\n").map(line => new Paragraph({ spacing: { after: line.trim() === "" ? 100 : 60 }, children: [new TextRun({ text: line, font: "Arial", size: 20, color: GRAY })] })), spacer());
  if (data.inventionBrief) children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }), sectionHeading("Invention Brief"), spacer(), ...data.inventionBrief.split("\n").map(line => new Paragraph({ spacing: { after: line.trim() === "" ? 120 : 60 }, children: [new TextRun({ text: line, font: "Arial", size: 20, color: line.startsWith(" ") || line.trim() === "" ? GRAY : BLACK, bold: /^[A-Z][A-Z\s]{3,}$/.test(line.trim()) })] })));
  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } }, paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 40, bold: true, font: "Arial", color: BLACK }, paragraph: { spacing: { before: 0, after: 160 }, outlineLevel: 0 } }, { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: "Arial", color: RED }, paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 } }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } }, children: [new TextRun({ text: "HAIIC Brainstorm", font: "Arial", size: 18, color: RED, bold: true }), new TextRun({ text: "\tapps-haiic.com", font: "Arial", size: 18, color: GRAY })] })] }) }, footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], children: [new TextRun({ text: "Human-AI Innovation Commons  ·  Co-authored with Claude", font: "Arial", size: 16, color: GRAY }), new TextRun({ children: ["\t", PageNumber.CURRENT], font: "Arial", size: 16, color: GRAY })] })] }) }, children }],
  });
  const blob = await Packer.toBlob(doc); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `HAIIC-Brainstorm-${(name || "invention").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.docx`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Novelty Advisor ──────────────────────────────────────────────────────────

function NoveltyAdvisor({ data, context, onSave }) {
  const [open, setOpen] = useState(false);
  const [assessment, setAssessment] = useState(data.noveltyAssessment || null);
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [thread, setThread] = useState(data.noveltyThread || []);

  const systemPrompt = `You are a knowledgeable friend who has been through the patent process. Give inventors an honest, plain-English read on novelty and patentability — and concrete suggestions to strengthen it. Tone: honest but encouraging. The first idea is rarely the best.

Structure every response with these exact headers:

🔍 THE HONEST READ
One paragraph on what's interesting and the main novelty challenge.

✅ WHAT'S WORKING
2-3 specific strengths. Be concrete.

⚠️ WATCH OUT FOR
1-2 prior art concerns in plain English.

💡 HOW TO STRENGTHEN IT
2-3 actionable suggestions — exactly what to add or change.

End with: "Remember: the first idea is rarely the best — every refinement gets you closer. This is a starting point, not a verdict. A registered patent attorney can run a full prior art search before you file."`;

  const runAssessment = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: systemPrompt, messages: [{ role: "user", content: `Assess the novelty and patentability of this invention:\n\n${context}` }], max_tokens: 900 }) });
      const result = await res.json();
      const text = result.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Unable to generate assessment.";
      setAssessment(text); const newThread = [{ role: "assistant", content: text }]; setThread(newThread);
      onSave({ noveltyAssessment: text, noveltyThread: newThread });
    } catch { setAssessment("Unable to generate assessment. Please try again."); } finally { setLoading(false); }
  };

  const askFollowUp = async () => {
    if (!followUp.trim() || loading) return;
    const userMsg = { role: "user", content: followUp }; const newThread = [...thread, userMsg];
    setThread(newThread); setFollowUp(""); setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: systemPrompt, messages: [{ role: "user", content: `Context:\n\n${context}` }, ...newThread], max_tokens: 600 }) });
      const result = await res.json();
      const text = result.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Unable to respond.";
      const updated = [...newThread, { role: "assistant", content: text }]; setThread(updated);
      onSave({ noveltyAssessment: assessment, noveltyThread: updated });
    } catch {} finally { setLoading(false); }
  };

  return (
    <div style={na.wrap}>
      <button onClick={() => setOpen(o => !o)} style={na.toggle}>🔬 Novelty Advisor &nbsp;{open ? "▲" : "▼"}{assessment && <span style={na.badge}>✓ Assessment ready</span>}</button>
      {open && (
        <div style={na.panel}>
          <p style={na.intro}>Get an honest read on how patentable your invention is — and exactly what to do to make it stronger.</p>
          {!assessment && !loading && <button onClick={runAssessment} style={na.runBtn}>Check Novelty & Patentability →</button>}
          {loading && <p style={na.loadingMsg}>Analyzing your invention…</p>}
          {assessment && (
            <>
              <div style={na.result}><pre style={na.resultText}>{thread[0]?.content || assessment}</pre></div>
              {thread.length > 1 && <div style={na.threadWrap}>{thread.slice(1).map((m, i) => (<div key={i} style={{ ...na.msg, background: m.role === "user" ? "transparent" : theme.surfaceAlt }}><span style={{ ...na.msgRole, color: m.role === "assistant" ? theme.red : theme.text }}>{m.role === "assistant" ? "Advisor" : "You"}:{"  "}</span><span style={na.msgText}>{m.content}</span></div>))}</div>}
              <div style={na.followRow}><input style={na.followInput} value={followUp} onChange={e => setFollowUp(e.target.value)} onKeyDown={e => e.key === "Enter" && askFollowUp()} placeholder="Ask a follow-up…" disabled={loading} /><button onClick={askFollowUp} disabled={loading || !followUp.trim()} style={na.askBtn}>Ask →</button></div>
              <button onClick={runAssessment} style={na.rerunBtn}>↻ Re-run with latest changes</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Session Toolbar ──────────────────────────────────────────────────────────

function SessionToolbar({ project, onSave, onExport, onDashboard, onSignOut, userEmail }) {
  const [saved, setSaved] = useState(false);
  const handleSave = () => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div style={tb.bar}>
      <button onClick={onDashboard} style={tb.dashBtn}>← Projects</button>
      <div style={tb.projectName}>{project.name}</div>
      <div style={tb.actions}>
        <button onClick={handleSave} style={{ ...tb.btn, color: saved ? "#4ade80" : theme.textMuted }}>{saved ? "✓ Saved" : "💾 Save Draft"}</button>
        <button onClick={onExport} style={tb.btn}>⬇ Export .docx</button>
        <span style={tb.userEmail}>{userEmail}</span>
        <button onClick={onSignOut} style={tb.signOutBtn}>Sign Out</button>
      </div>
    </div>
  );
}

// ─── Project Dashboard ────────────────────────────────────────────────────────

function ProjectDashboard({ onNew, onResume, onSignOut, userEmail }) {
  const [projects, setProjects] = useState([]);
  const [newName,  setNewName]  = useState("");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await supabase.from(TABLE).select("*").order("updated_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  const handleNew = async () => {
    const name = newName.trim() || `Invention — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const { data: { user } } = await supabase.auth.getUser();
    const project = { id: genId(), user_id: user.id, name, phase: 0, data: {} };
    await supabase.from(TABLE).insert(project);
    setNewName("");
    onNew(project);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await supabase.from(TABLE).delete().eq("id", id);
    setProjects(p => p.filter(x => x.id !== id));
  };

  const handleRename = async (id) => {
    const p = projects.find(p => p.id === id); const n = prompt("Rename project:", p.name); if (!n?.trim()) return;
    await supabase.from(TABLE).update({ name: n.trim(), updated_at: new Date().toISOString() }).eq("id", id);
    setProjects(prev => prev.map(x => x.id === id ? { ...x, name: n.trim() } : x));
  };

  const phaseLabel = (i) => i >= PHASES.length - 1 ? "Complete ★" : PHASES[i]?.label || "?";

  return (
    <div style={ps.content}>
      <div style={db.topRow}>
        <h2 style={ps.title}>Your Brainstorm Projects</h2>
        <div style={db.userRow}>
          <span style={db.userEmail}>{userEmail}</span>
          <button onClick={onSignOut} style={db.signOutBtn}>Sign Out</button>
        </div>
      </div>
      <p style={ps.desc}>Each project saves automatically — resume from any device, any time.</p>
      <div style={db.newRow}>
        <input style={{ ...ps.input, flex: 1, marginTop: 0 }} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleNew()} placeholder="Name your invention idea (optional)..." />
        <button onClick={handleNew} style={ps.startBtn}>Start New Project →</button>
      </div>
      {loading && <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading your projects…</p>}
      {!loading && projects.length > 0 && (
        <div style={db.list}>
          <p style={db.listHeader}>SAVED PROJECTS ({projects.length})</p>
          {projects.map(p => (
            <div key={p.id} style={db.card}>
              <div style={db.cardLeft}>
                <div style={db.cardName}>{p.name}</div>
                <div style={db.cardMeta}>Last saved {new Date(p.updated_at).toLocaleString()} &nbsp;·&nbsp; Stage: <span style={{ color: theme.red }}>{phaseLabel(p.phase)}</span></div>
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
      {!loading && projects.length === 0 && <div style={db.empty}>No saved projects yet. Start your first invention above.</div>}
    </div>
  );
}

// ─── Phase Components ─────────────────────────────────────────────────────────

function WelcomePhase({ onNext }) {
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Welcome to Brainstorm</h2>
      <p style={ps.desc}>You have expertise that's more valuable than you think. Brainstorm is an AI-powered coach that helps you discover patentable innovations hiding in your professional knowledge.</p>
      <p style={ps.desc}>We'll walk through a guided conversation in five steps: understanding your expertise, identifying problems worth solving, exploring root causes, brainstorming solutions, and refining the strongest idea into an Invention Brief you can take straight into Patent Forge.</p>
      <p style={ps.desc}>No technical background required. No legal knowledge needed. Just your experience and willingness to think creatively.</p>
      <p style={{ fontSize: 13, color: theme.textDim, marginBottom: 16 }}>☁️ Your progress saves automatically to your account. Resume from any device, any time.</p>
      <button onClick={onNext} style={ps.startBtn}>Let's Get Started →</button>
    </div>
  );
}

function DomainPhase({ data, setData, onNext }) {
  const [field, setField] = useState(data.field || ""); const [role, setRole] = useState(data.role || ""); const [insight, setInsight] = useState(data.insight || "");
  const canProceed = field.trim() && role.trim() && insight.trim();
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Tell Us About Your Expertise</h2>
      <p style={ps.desc}>We'll use this to understand your world before we start exploring ideas.</p>
      <label style={ps.label}>What field or industry do you work in?</label>
      <input style={ps.input} value={field} onChange={e => setField(e.target.value)} placeholder="e.g., Manufacturing, Healthcare, Education, Construction..." />
      <label style={ps.label}>What's your role or specialty?</label>
      <input style={ps.input} value={role} onChange={e => setRole(e.target.value)} placeholder="e.g., Machine operator, Nurse practitioner, High school teacher..." />
      <label style={ps.label}>What's something about your work that outsiders don't understand?</label>
      <textarea style={ps.textarea} value={insight} onChange={e => setInsight(e.target.value)} placeholder="The hidden knowledge, the workarounds, the things you know that aren't in any manual..." rows={4} />
      <button onClick={() => { setData({ ...data, field, role, insight }); onNext(); }} disabled={!canProceed} style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed" }}>Next: Define the Problem →</button>
    </div>
  );
}

function ProblemPhase({ data, setData, onNext }) {
  const chat = useChat(`You are an innovation coach at HAIIC helping someone discover patentable innovations.\nField: ${data.field}\nRole: ${data.role}\nInsight: ${data.insight}\nHelp them identify a specific problem worth solving. Acknowledge their expertise warmly, ask what frustrates them most, help them articulate the problem clearly. Keep responses to 2-3 paragraphs. Be encouraging.`);
  const initialized = useRef(false);
  useEffect(() => { if (!initialized.current && chat.messages.length === 0) { initialized.current = true; chat.send("[SYSTEM: Greet warmly, reference their field and role, ask about frustrations or problems in their work.]"); } }, []);
  const proceed = () => { setData({ ...data, problemDiscussion: chat.messages.map(m => `${m.role}: ${m.content}`).join("\n") }); onNext(); };
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Define the Problem</h2>
      <p style={ps.desc}>Let's identify what's broken, slow, or frustrating in your field. The best inventions start with real problems.</p>
      <ChatThread messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))} loading={chat.loading} onSend={msg => chat.send(msg)} placeholder="Describe what frustrates you most..." />
      {chat.messages.length > 3 && <button onClick={proceed} style={ps.nextBtn}>Next: Explore Deeper →</button>}
    </div>
  );
}

function DeepenPhase({ data, setData, onNext }) {
  const chat = useChat(`You are an innovation coach at HAIIC helping someone explore a problem deeply.\nField: ${data.field}\nRole: ${data.role}\nProblem: ${(data.problemDiscussion || "").substring(0, 1500)}\nAsk about root causes, failed solutions, ripple effects, hidden assumptions. Summarize the key insight that could lead to a novel solution. Keep responses to 2-3 paragraphs.`);
  const initialized = useRef(false);
  useEffect(() => { if (!initialized.current && chat.messages.length === 0) { initialized.current = true; chat.send("[SYSTEM: Reference the problem identified and probe deeper — root causes, failed solutions.]"); } }, []);
  const proceed = () => { setData({ ...data, deepenDiscussion: chat.messages.map(m => `${m.role}: ${m.content}`).join("\n") }); onNext(); };
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Explore the Problem</h2>
      <p style={ps.desc}>Let's dig into why this problem exists and what's been tried before.</p>
      <ChatThread messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))} loading={chat.loading} onSend={msg => chat.send(msg)} placeholder="Share what you know about why this problem persists..." />
      {chat.messages.length > 3 && <button onClick={proceed} style={ps.nextBtn}>Next: Brainstorm Solutions →</button>}
    </div>
  );
}

function IdeatePhase({ data, setData, onNext }) {
  const chat = useChat(`You are an innovation coach at HAIIC helping someone brainstorm solutions.\nField: ${data.field}\nRole: ${data.role}\nProblem: ${(data.problemDiscussion || "").substring(0, 1000)}\nExploration: ${(data.deepenDiscussion || "").substring(0, 1000)}\nPropose 3-4 diverse ideas: practical improvement, ambitious reimagining, cross-industry inspiration, moonshot. Help identify the 2-3 strongest. Keep energy high!`);
  const initialized = useRef(false);
  useEffect(() => { if (!initialized.current && chat.messages.length === 0) { initialized.current = true; chat.send("[SYSTEM: Summarize the problem in one sentence, then propose 3-4 diverse solution ideas. Ask which ones resonate.]"); } }, []);
  const proceed = () => { setData({ ...data, ideationDiscussion: chat.messages.map(m => `${m.role}: ${m.content}`).join("\n") }); onNext(); };
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Brainstorm Solutions</h2>
      <p style={ps.desc}>Now the creative part. Let's generate ideas — wild and practical.</p>
      <ChatThread messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))} loading={chat.loading} onSend={msg => chat.send(msg)} placeholder="React to the ideas — what excites you? What would you change?" />
      {chat.messages.length > 4 && <button onClick={proceed} style={ps.nextBtn}>Narrow Down & Refine →</button>}
    </div>
  );
}

function RefinePhase({ data, setData, onNext }) {
  const chat = useChat(`You are an innovation coach at HAIIC helping someone refine their best idea.\nField: ${data.field}\nRole: ${data.role}\nBrainstorming: ${(data.ideationDiscussion || "").substring(0, 1500)}\nHelp them pick their strongest idea, get technical — components, materials, mechanisms, what makes it novel. Push for specificity. After 3-4 exchanges help them articulate: "A [thing] that [does what] by [how] to solve [problem]"`);
  const initialized = useRef(false);
  useEffect(() => { if (!initialized.current && chat.messages.length === 0) { initialized.current = true; chat.send("[SYSTEM: Help select and refine the strongest idea from brainstorming. Push for technical specificity.]"); } }, []);
  const proceed = () => { setData({ ...data, refineDiscussion: chat.messages.map(m => `${m.role}: ${m.content}`).join("\n") }); onNext(); };
  const noveltyContext = `Field: ${data.field || "—"}\nRole: ${data.role || "—"}\nProblem: ${(data.problemDiscussion || "").substring(0, 500)}\nIdeas: ${(data.ideationDiscussion || "").substring(0, 500)}\nRefinement: ${(data.refineDiscussion || "").substring(0, 600)}`;
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Refine Your Invention</h2>
      <p style={ps.desc}>Let's take the strongest idea and make it concrete. Specificity is what turns a good idea into a patentable invention.</p>
      <ChatThread messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))} loading={chat.loading} onSend={msg => chat.send(msg)} placeholder="Describe how it would work in more detail..." />
      {chat.messages.length > 4 && (<><button onClick={proceed} style={ps.nextBtn}>Generate Invention Brief →</button><NoveltyAdvisor data={data} context={noveltyContext} onSave={(u) => setData({ ...data, ...u })} /></>)}
    </div>
  );
}

function SummaryPhase({ data, setData, projectName }) {
  const [brief, setBrief] = useState(data.inventionBrief || "");
  const [loading, setLoading] = useState(!data.inventionBrief);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!data.inventionBrief) generateBrief(); }, []);

  const generateBrief = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: `Generate a structured Invention Brief for HAIIC with these sections:\nINVENTION BRIEF\n===============\nTitle: [title]\nField: [field]\nInventor Background: [summary]\n\nPROBLEM STATEMENT\n[2-3 sentences]\n\nPROPOSED SOLUTION\n[2-3 paragraphs]\n\nKEY COMPONENTS\n[list]\n\nNOVELTY FACTORS\n[what makes it different]\n\nTARGET USERS\n[who and why]\n\nRECOMMENDED NEXT STEP\nThis Invention Brief is ready to be taken into Patent Forge.`, messages: [{ role: "user", content: `Generate the Invention Brief:\nField: ${data.field}\nRole: ${data.role}\nInsight: ${data.insight}\nProblem: ${(data.problemDiscussion || "").substring(0, 1200)}\nExploration: ${(data.deepenDiscussion || "").substring(0, 1200)}\nBrainstorming: ${(data.ideationDiscussion || "").substring(0, 1200)}\nRefinement: ${(data.refineDiscussion || "").substring(0, 1200)}` }], max_tokens: 2000 }) });
      const result = await res.json();
      const text = result.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Unable to generate brief.";
      setBrief(text); setData(prev => ({ ...prev, inventionBrief: text }));
    } catch { setBrief("Unable to generate brief. Please try again."); } finally { setLoading(false); }
  };

  const handleTakeToForge = () => {
    try {
      const titleMatch = brief.match(/Title:\s*(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : projectName || "";
      localStorage.setItem(HANDOFF_KEY, JSON.stringify({ name: projectName || title || "Brainstorm Import", patentTitle: title, patentField: data.field, field: data.field, role: data.role, insight: data.insight, inventionBrief: brief, noveltyAssessment: data.noveltyAssessment || null, timestamp: new Date().toISOString() }));
    } catch {}
    window.location.href = "/patent-forge";
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Invention Brief</h2>
      <p style={ps.desc}>Here's your complete Invention Brief, ready to take into Patent Forge.</p>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}><p>Generating your Invention Brief…</p></div> : (
        <>
          <div style={ps.briefCard}><pre style={ps.briefText}>{brief}</pre></div>
          <div style={ps.briefActions}>
            <button onClick={() => { navigator.clipboard.writeText(brief); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={ps.copyBtn}>{copied ? "✓ Copied!" : "Copy to Clipboard"}</button>
            <button onClick={handleTakeToForge} style={ps.forgeBtn}>Take to Patent Forge →</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BrainstormPage() {
  const router  = useRouter();
  const [user,    setUser]    = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view,    setView]    = useState("dashboard");
  const [project, setProject] = useState(null);
  const [phase,   setPhase]   = useState(0);
  const [data,    setData]    = useState({});

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login?next=/brainstorm"); return; }
      setUser(session.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/login?next=/brainstorm");
      else setUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-save to Supabase
  useEffect(() => {
    if (!project || authLoading) return;
    const save = async () => {
      await supabase.from(TABLE).update({ phase, data, updated_at: new Date().toISOString() }).eq("id", project.id);
    };
    const timer = setTimeout(save, 800);
    return () => clearTimeout(timer);
  }, [phase, data]);

  const handleSetData = (newData) => setData(newData);
  const goNext = () => setPhase(p => Math.min(p + 1, PHASES.length - 1));
  const goToPhase = (t) => { if (t < phase) setPhase(t); };

  const handleNew = (proj) => { setProject(proj); setPhase(proj.phase || 0); setData(proj.data || {}); setView("session"); };
  const handleResume = (proj) => { setProject(proj); setPhase(proj.phase || 0); setData(proj.data || {}); setView("session"); };
  const handleDashboard = async () => {
    if (project) await supabase.from(TABLE).update({ phase, data, updated_at: new Date().toISOString() }).eq("id", project.id);
    setView("dashboard"); setProject(null); setPhase(0); setData({});
  };
  const handleSave = async () => {
    if (!project) return;
    await supabase.from(TABLE).update({ phase, data, updated_at: new Date().toISOString() }).eq("id", project.id);
  };
  const handleExport = () => { if (project) exportToDocx({ ...project, phase, data }); };
  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  if (authLoading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: theme.textMuted, fontFamily: "'DM Sans', sans-serif" }}>Loading…</div>;

  if (view === "dashboard") {
    return (
      <Layout title="Brainstorm" logoSrc="/brainstorm-logo.png">
        <div style={styles.header}><p style={styles.label}>BRAINSTORM</p><h1 style={styles.heading}>Discover Your Next Invention</h1></div>
        <ProjectDashboard onNew={handleNew} onResume={handleResume} onSignOut={handleSignOut} userEmail={user?.email} />
      </Layout>
    );
  }

  return (
    <Layout title="Brainstorm" logoSrc="/brainstorm-logo.png">
      <div style={styles.header}><p style={styles.label}>BRAINSTORM</p><h1 style={styles.heading}>Discover Your Next Invention</h1></div>
      <div style={tb.bar}>
        <button onClick={handleDashboard} style={tb.dashBtn}>← Projects</button>
        <div style={tb.projectName}>{project.name}</div>
        <div style={tb.actions}>
          <button onClick={handleSave} style={tb.btn}>💾 Save</button>
          <button onClick={handleExport} style={tb.btn}>⬇ Export .docx</button>
          <span style={tb.userEmail}>{user?.email}</span>
          <button onClick={handleSignOut} style={tb.signOutBtn}>Sign Out</button>
        </div>
      </div>
      <div style={styles.phases}>
        {PHASES.map((p, i) => {
          const isActive = i === phase, isCompleted = i < phase;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div onClick={() => isCompleted && goToPhase(i)} title={isCompleted ? `Return to ${p.label}` : undefined} style={{ ...styles.phaseChip, background: isActive ? theme.red : isCompleted ? theme.surfaceAlt : "transparent", borderColor: isActive || isCompleted ? theme.red : theme.border, color: isActive ? "#fff" : isCompleted ? theme.textMuted : theme.textDim, cursor: isCompleted ? "pointer" : "default" }}>
                {isCompleted && <span style={{ marginRight: 3, fontSize: 9 }}>✓</span>}{p.icon} {p.label}
              </div>
              {i < PHASES.length - 1 && <span style={{ color: theme.textDim, fontSize: 10 }}>›</span>}
            </div>
          );
        })}
      </div>
      {phase === 0 && <WelcomePhase onNext={goNext} />}
      {phase === 1 && <DomainPhase  data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 2 && <ProblemPhase data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 3 && <DeepenPhase  data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 4 && <IdeatePhase  data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 5 && <RefinePhase  data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 6 && <SummaryPhase data={data} setData={handleSetData} projectName={project?.name} />}
    </Layout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  header: { marginBottom: 24 },
  label: { color: theme.red, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 },
  heading: { fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: theme.text },
  phases: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 32, paddingBottom: 20, borderBottom: `1px solid ${theme.border}` },
  phaseChip: { border: "1px solid", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s ease" },
};

const ps = {
  content:  { marginTop: 8 },
  title:    { fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: theme.text, marginBottom: 12 },
  desc:     { fontSize: 15, lineHeight: 1.7, color: theme.textMuted, marginBottom: 16 },
  label:    { display: "block", fontSize: 13, fontWeight: 600, color: theme.textMuted, marginBottom: 6, marginTop: 16 },
  input:    { width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" },
  startBtn: { background: theme.red, border: "none", borderRadius: 8, color: "#fff", padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" },
  nextBtn:  { background: theme.red, border: "none", borderRadius: 8, color: "#fff", padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 12 },
  briefCard: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24, marginBottom: 20 },
  briefText: { fontSize: 13, lineHeight: 1.7, color: "#ccc", fontFamily: "'DM Sans', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  briefActions: { display: "flex", gap: 12, flexWrap: "wrap" },
  copyBtn:  { padding: "12px 20px", background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textMuted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  forgeBtn: { padding: "12px 20px", background: theme.red, border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center" },
};

const db = {
  topRow:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  userRow:    { display: "flex", alignItems: "center", gap: 10 },
  userEmail:  { fontSize: 12, color: theme.textDim },
  signOutBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
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
  actions:     { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  btn:         { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  userEmail:   { fontSize: 11, color: theme.textDim },
  signOutBtn:  { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
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
