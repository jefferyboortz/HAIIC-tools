import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import Layout from "../components/Layout";
import ChatThread from "../components/ChatThread";
import useChat from "../components/useChat";
import theme from "../components/theme";

const supabase = createClient(
  "https://quruzppflgdbddxyylxu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnV6cHBmbGdkYmRkeHl5bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDQ1NTEsImV4cCI6MjA4OTE4MDU1MX0.y6acgCo6EZZiEDIJHSx6J3T60L1P6M_DH3vTIulFvJ0"
);

const SECTIONS = [
  { id: "inventor",    label: "Inventor Info",  icon: "①" },
  { id: "agreement",   label: "Our Vision",     icon: "②" },
  { id: "title",       label: "Title & Field",  icon: "③" },
  { id: "description", label: "Description",    icon: "④" },
  { id: "claims",      label: "Claims",         icon: "⑤" },
  { id: "review",      label: "Filing Package", icon: "★" },
];

const HANDOFF_KEY = "haiic_pf_handoff";
const TABLE       = "patent_projects";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ─── Export (.docx) ───────────────────────────────────────────────────────────

async function exportToDocx(project) {
  const { name, data, section } = project;
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Header, Footer, PageNumber, TabStopType, TabStopPosition } = await import("docx");
  const RED = "C0392B", GRAY = "666666", BLACK = "1A1A1A";
  const spacer = (sz = 160) => new Paragraph({ children: [new TextRun("")], spacing: { after: sz } });
  const sh = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } }, children: [new TextRun({ text, color: RED, bold: true, font: "Arial", size: 26 })] });
  const bt = (text, opts = {}) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, font: "Arial", size: 20, color: GRAY, ...opts })] });
  const lv = (label, value) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${label}  `, bold: true, font: "Arial", size: 20, color: BLACK }), new TextRun({ text: value || "—", font: "Arial", size: 20, color: GRAY })] });
  const rd = (raw) => {
    if (!raw) return [];
    return raw.split("\n").flatMap(line => {
      const t = line.trim(); if (!t || t.startsWith("[SYSTEM:")) return [];
      const isA = t.startsWith("assistant:"), isU = t.startsWith("user:");
      const role = isA ? "AI Assistant" : isU ? "Inventor" : null;
      const body = role ? t.slice(t.indexOf(":") + 1).trim() : t;
      return [new Paragraph({ spacing: { after: 60 }, children: [...(role ? [new TextRun({ text: `${role}:  `, bold: true, color: isA ? RED : BLACK, font: "Arial", size: 20 })] : []), new TextRun({ text: body, font: "Arial", size: 20, color: GRAY })] })];
    });
  };
  const children = [];
  children.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 40 }, children: [new TextRun({ text: "HUMAN-AI INNOVATION COMMONS", font: "Arial", size: 18, bold: true, color: RED, allCaps: true })] }), new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 80 }, children: [new TextRun({ text: data.patentTitle || name || "Provisional Patent Application", font: "Arial", size: 40, bold: true, color: BLACK })] }), lv("Inventor:", data.inventorName), lv("Location:", [data.city, data.state, data.country].filter(Boolean).join(", ")), lv("Date:", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })), lv("Stage:", SECTIONS[section]?.label || "Complete"), spacer(320));
  children.push(sh("Our Shared Vision"), spacer(80), bt("HAIIC was built on the belief that when AI helps create something valuable, the wealth it generates should flow back to the people AI affects most. Patent Forge is free because democratizing invention is the right thing to do — no fine print, no hidden fees, no claiming ownership of your idea."), spacer(80), bt("The model we live by distributes value equally: one third to the inventor; one third to programs supporting workers displaced by AI; and one third to AI safety research."), spacer(80), bt("This is our compass, not a clause. The invention belongs to its inventor. But if it succeeds, we hope they'll remember where the idea started — and consider paying it forward.", { italics: true, color: "888888" }), spacer(80), lv("Inventor:", data.inventorName || "—"), lv("Date:", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })), spacer(160));
  if (data.patentTitle || data.patentField || data.summary) { children.push(sh("Title & Field of Invention"), spacer(80)); if (data.patentTitle) children.push(lv("Title:", data.patentTitle)); if (data.patentField) children.push(lv("Field:", data.patentField)); if (data.summary) children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Summary:", bold: true, font: "Arial", size: 20, color: BLACK })] }), bt(data.summary)); children.push(spacer(160)); }
  if (data.noveltyAssessment) children.push(sh("Novelty & Patentability Assessment"), spacer(80), ...data.noveltyAssessment.split("\n").map(line => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: line, font: "Arial", size: 20, color: GRAY })] })), spacer(160));
  if (data.descriptionDiscussion) children.push(sh("Detailed Description — Working Session"), spacer(80), ...rd(data.descriptionDiscussion), spacer(160));
  if (data.claimsDiscussion) children.push(sh("Patent Claims — Working Session"), spacer(80), ...rd(data.claimsDiscussion), spacer(160));
  if (data.filingDocument) { children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }), new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: "PROVISIONAL PATENT APPLICATION", font: "Arial", size: 28, bold: true, color: BLACK, allCaps: true })] }), spacer(80), ...data.filingDocument.split("\n").map(line => { const t = line.trim(); const isH = /^[A-Z][A-Z\s]{4,}$/.test(t) && t.length < 60; return new Paragraph({ spacing: { after: t === "" ? 120 : 60 }, ...(isH ? { heading: HeadingLevel.HEADING_2 } : {}), children: [new TextRun({ text: line, font: "Arial", size: isH ? 22 : 20, bold: isH, color: isH ? RED : GRAY })] }); })); }
  const doc = new Document({ styles: { default: { document: { run: { font: "Arial", size: 22 } } }, paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 40, bold: true, font: "Arial", color: BLACK }, paragraph: { spacing: { before: 0, after: 160 }, outlineLevel: 0 } }, { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: "Arial", color: RED }, paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 1 } }] }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } }, children: [new TextRun({ text: "HAIIC Patent Forge", font: "Arial", size: 18, color: RED, bold: true }), new TextRun({ text: "\tapps-haiic.com", font: "Arial", size: 18, color: GRAY })] })] }) }, footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], children: [new TextRun({ text: "Human-AI Innovation Commons  ·  Co-authored with Claude", font: "Arial", size: 16, color: GRAY }), new TextRun({ children: ["\t", PageNumber.CURRENT], font: "Arial", size: 16, color: GRAY })] })] }) }, children }] });
  const blob = await Packer.toBlob(doc); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `HAIIC-PatentForge-${(data.patentTitle || name || "patent").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.docx`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Novelty Advisor ──────────────────────────────────────────────────────────

function NoveltyAdvisor({ data, context, onSave }) {
  const [open, setOpen] = useState(false); const [assessment, setAssessment] = useState(data.noveltyAssessment || null); const [loading, setLoading] = useState(false); const [followUp, setFollowUp] = useState(""); const [thread, setThread] = useState(data.noveltyThread || []);
  const sys = `You are a knowledgeable friend who has been through the patent process. Give inventors an honest, plain-English read on novelty and patentability — and concrete suggestions to strengthen it. Tone: honest but encouraging.\n\n🔍 THE HONEST READ\nOne paragraph.\n\n✅ WHAT'S WORKING\n2-3 specific strengths.\n\n⚠️ WATCH OUT FOR\n1-2 prior art concerns.\n\n💡 HOW TO STRENGTHEN IT\n2-3 actionable suggestions.\n\nEnd with: "Remember: the first idea is rarely the best — every refinement gets you closer. This is a starting point, not a verdict. A registered patent attorney can run a full prior art search before you file."`;
  const run = async () => { setLoading(true); try { const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: sys, messages: [{ role: "user", content: `Assess:\n\n${context}` }], max_tokens: 900 }) }); const r = await res.json(); const text = r.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Unable to generate."; setAssessment(text); const nt = [{ role: "assistant", content: text }]; setThread(nt); onSave({ noveltyAssessment: text, noveltyThread: nt }); } catch { setAssessment("Unable to generate."); } finally { setLoading(false); } };
  const ask = async () => { if (!followUp.trim() || loading) return; const um = { role: "user", content: followUp }; const nt = [...thread, um]; setThread(nt); setFollowUp(""); setLoading(true); try { const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: sys, messages: [{ role: "user", content: `Context:\n\n${context}` }, ...nt], max_tokens: 600 }) }); const r = await res.json(); const text = r.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Unable to respond."; const updated = [...nt, { role: "assistant", content: text }]; setThread(updated); onSave({ noveltyAssessment: assessment, noveltyThread: updated }); } catch {} finally { setLoading(false); } };
  return (
    <div style={na.wrap}>
      <button onClick={() => setOpen(o => !o)} style={na.toggle}>🔬 Novelty Advisor &nbsp;{open ? "▲" : "▼"}{assessment && <span style={na.badge}>✓ Ready</span>}</button>
      {open && (<div style={na.panel}><p style={na.intro}>An honest read on patentability — and exactly what to do to strengthen it.</p>{!assessment && !loading && <button onClick={run} style={na.runBtn}>Check Novelty & Patentability →</button>}{loading && <p style={na.loadingMsg}>Analyzing…</p>}{assessment && (<><div style={na.result}><pre style={na.resultText}>{thread[0]?.content || assessment}</pre></div>{thread.length > 1 && <div style={na.threadWrap}>{thread.slice(1).map((m, i) => (<div key={i} style={{ ...na.msg, background: m.role === "user" ? "transparent" : theme.surfaceAlt }}><span style={{ ...na.msgRole, color: m.role === "assistant" ? theme.red : theme.text }}>{m.role === "assistant" ? "Advisor" : "You"}:{"  "}</span><span style={na.msgText}>{m.content}</span></div>))}</div>}<div style={na.followRow}><input style={na.followInput} value={followUp} onChange={e => setFollowUp(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} placeholder="Ask a follow-up…" disabled={loading} /><button onClick={ask} disabled={loading || !followUp.trim()} style={na.askBtn}>Ask →</button></div><button onClick={run} style={na.rerunBtn}>↻ Re-run</button></>)}</div>)}
    </div>
  );
}

// ─── Project Dashboard ────────────────────────────────────────────────────────

function ProjectDashboard({ onNew, onResume, onSignOut, userEmail }) {
  const [projects, setProjects] = useState([]); const [newName, setNewName] = useState(""); const [loading, setLoading] = useState(true); const [handoff, setHandoff] = useState(null);
  useEffect(() => { fetchProjects(); try { const h = localStorage.getItem(HANDOFF_KEY); if (h) setHandoff(JSON.parse(h)); } catch {} }, []);
  const fetchProjects = async () => { setLoading(true); const { data } = await supabase.from(TABLE).select("*").order("updated_at", { ascending: false }); setProjects(data || []); setLoading(false); };
  const handleHandoff = async () => { if (!handoff) return; const { data: { user } } = await supabase.auth.getUser(); const project = { id: genId(), user_id: user.id, name: handoff.name || "Brainstorm Import", section: 0, data: { patentTitle: handoff.patentTitle || "", patentField: handoff.patentField || handoff.field || "", summary: handoff.inventionBrief ? handoff.inventionBrief.substring(0, 400) : "", brainstormBrief: handoff.inventionBrief || "", noveltyAssessment: handoff.noveltyAssessment || null, fromBrainstorm: true } }; await supabase.from(TABLE).insert(project); try { localStorage.removeItem(HANDOFF_KEY); } catch {} setHandoff(null); onNew(project); };
  const handleNew = async () => { const name = newName.trim() || `Patent Application — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`; const { data: { user } } = await supabase.auth.getUser(); const project = { id: genId(), user_id: user.id, name, section: 0, data: {} }; await supabase.from(TABLE).insert(project); setNewName(""); onNew(project); };
  const handleDelete = async (id, name) => { if (!confirm(`Delete "${name}"?`)) return; await supabase.from(TABLE).delete().eq("id", id); setProjects(p => p.filter(x => x.id !== id)); };
  const handleRename = async (id) => { const p = projects.find(p => p.id === id); const n = prompt("Rename:", p.name); if (!n?.trim()) return; await supabase.from(TABLE).update({ name: n.trim(), updated_at: new Date().toISOString() }).eq("id", id); setProjects(prev => prev.map(x => x.id === id ? { ...x, name: n.trim() } : x)); };
  const sl = (i) => i >= SECTIONS.length - 1 ? "Complete ★" : SECTIONS[i]?.label || "?";
  return (
    <div style={ps.content}>
      <div style={db.topRow}><h2 style={ps.title}>Your Patent Applications</h2><div style={db.userRow}><span style={db.userEmail}>{userEmail}</span><button onClick={onSignOut} style={db.signOutBtn}>Sign Out</button></div></div>
      <p style={ps.desc}>Each application saves automatically — resume from any device, any time.</p>
      {handoff && (<div style={hf.banner}><div style={hf.bannerLeft}><div style={hf.bannerTitle}>🔗 Brainstorm session ready to continue</div><div style={hf.bannerMeta}>"{handoff.name}" — title, field, and brief pre-filled.</div></div><div style={hf.bannerRight}><button onClick={handleHandoff} style={hf.continueBtn}>Continue in Patent Forge →</button><button onClick={() => { try { localStorage.removeItem(HANDOFF_KEY); } catch {} setHandoff(null); }} style={hf.dismissBtn}>Dismiss</button></div></div>)}
      <div style={db.newRow}><input style={{ ...ps.input, flex: 1, marginTop: 0 }} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleNew()} placeholder="Name your invention (optional)..." /><button onClick={handleNew} style={ps.nextBtn}>Start New Application →</button></div>
      {loading && <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading your applications…</p>}
      {!loading && projects.length > 0 && (<div style={db.list}><p style={db.listHeader}>SAVED APPLICATIONS ({projects.length})</p>{projects.map(p => (<div key={p.id} style={db.card}><div style={db.cardLeft}><div style={db.cardName}>{p.name}{p.data?.fromBrainstorm && <span style={hf.tag}>from Brainstorm</span>}</div><div style={db.cardMeta}>Last saved {new Date(p.updated_at).toLocaleString()} &nbsp;·&nbsp; Stage: <span style={{ color: theme.red }}>{sl(p.section)}</span></div></div><div style={db.cardRight}><button onClick={() => onResume(p)} style={db.resumeBtn}>Resume →</button><button onClick={() => handleRename(p.id)} style={db.iconBtn} title="Rename">✏</button><button onClick={() => handleDelete(p.id, p.name)} style={db.iconBtn} title="Delete">✕</button></div></div>))}</div>)}
      {!loading && projects.length === 0 && !handoff && <div style={db.empty}>No saved applications yet. Start your first one above.</div>}
    </div>
  );
}

// ─── Section Components ───────────────────────────────────────────────────────

function InventorSection({ data, setData, onNext }) {
  const [name, setName] = useState(data.inventorName || ""); const [city, setCity] = useState(data.city || ""); const [state, setState] = useState(data.state || ""); const [country, setCountry] = useState(data.country || "United States"); const [email, setEmail] = useState(data.email || "");
  const canProceed = name.trim() && city.trim() && state.trim();
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Inventor Information</h2>
      <p style={ps.desc}>This is who will be named on the provisional patent application.</p>
      {data.fromBrainstorm && <div style={hf.infoBar}>💡 Your Brainstorm session has been pre-loaded — title, field, and brief are ready in the next steps.</div>}
      <label style={ps.label}>Full Legal Name</label><input style={ps.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Jane M. Smith" />
      <label style={ps.label}>City</label><input style={ps.input} value={city} onChange={e => setCity(e.target.value)} placeholder="e.g., Decatur" />
      <label style={ps.label}>State / Province</label><input style={ps.input} value={state} onChange={e => setState(e.target.value)} placeholder="e.g., Georgia" />
      <label style={ps.label}>Country</label><input style={ps.input} value={country} onChange={e => setCountry(e.target.value)} />
      <label style={ps.label}>Email (optional)</label><input style={ps.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="For filing correspondence" />
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
        <p style={ps.agreementText}>We're not asking you to sign a contract. We're inviting you into a vision. Here's the model we live by:</p>
        <div style={ps.splits}>
          <div style={ps.split}><div style={ps.splitPct}>33⅓%</div><div style={ps.splitLabel}>The Inventor</div><p style={ps.splitDesc}>You brought the expertise and lived experience. That deserves to be rewarded.</p></div>
          <div style={ps.split}><div style={ps.splitPct}>33⅓%</div><div style={ps.splitLabel}>Displaced Workers</div><p style={ps.splitDesc}>Those most affected by AI deserve a share of what it creates.</p></div>
          <div style={ps.split}><div style={ps.splitPct}>33⅓%</div><div style={ps.splitLabel}>AI Safety Research</div><p style={ps.splitDesc}>So that AI keeps working for everyone — not just those who own it.</p></div>
        </div>
        <p style={ps.agreementNote}>This is our compass, not a clause. Your invention is yours. But if it succeeds, we hope you'll consider paying it forward.</p>
      </div>
      <label style={ps.checkboxLabel}><input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setData({ ...data, agreed: e.target.checked }); }} style={ps.checkbox} />I've read HAIIC's vision and I'm ready to move forward. This is not a legal obligation — it's an invitation to be part of something better.</label>
      <button onClick={onNext} disabled={!agreed} style={{ ...ps.nextBtn, opacity: agreed ? 1 : 0.4, cursor: agreed ? "pointer" : "not-allowed" }}>I'm In — Next: Title & Field →</button>
    </div>
  );
}

function TitleSection({ data, setData, onNext }) {
  const [title, setTitle] = useState(data.patentTitle || ""); const [field, setField] = useState(data.patentField || ""); const [summary, setSummary] = useState(data.summary || "");
  const canProceed = title.trim() && field.trim() && summary.trim();
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Title & Field of Invention</h2>
      <p style={ps.desc}>Name your invention and describe it at a high level.</p>
      {data.brainstormBrief && <div style={hf.infoBar}>💡 Your Invention Brief from Brainstorm is saved and the AI will use it as context throughout.</div>}
      <label style={ps.label}>Invention Title</label><input style={ps.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Self-Adjusting Ergonomic Assembly Fixture" />
      <p style={ps.hint}>Descriptive but concise.</p>
      <label style={ps.label}>Technical Field</label><input style={ps.input} value={field} onChange={e => setField(e.target.value)} placeholder="e.g., Manufacturing Equipment, Medical Devices..." />
      <label style={ps.label}>Brief Summary (2-3 sentences)</label><textarea style={ps.textarea} value={summary} onChange={e => setSummary(e.target.value)} placeholder="What does your invention do? What problem does it solve? What makes it different?" rows={4} />
      <button onClick={() => { setData({ ...data, patentTitle: title, patentField: field, summary }); onNext(); }} disabled={!canProceed} style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed" }}>Next: Detailed Description →</button>
    </div>
  );
}

function DescriptionSection({ data, setData, onNext }) {
  const bsCtx = data.brainstormBrief ? `\nInvention Brief from Brainstorm:\n${data.brainstormBrief.substring(0, 1000)}` : "";
  const chat = useChat(`You are a patent drafting assistant at HAIIC helping write the Detailed Description.\nInvention: ${data.patentTitle}\nField: ${data.patentField}\nSummary: ${data.summary}\nInventor: ${data.inventorName}${bsCtx}\nAsk about key components, materials, dimensions, alternative embodiments. Push for detail that lets someone reproduce it.`);
  const initialized = useRef(false);
  useEffect(() => { if (!initialized.current && chat.messages.length === 0) { initialized.current = true; chat.send(`[SYSTEM: Acknowledge "${data.patentTitle}" and ask the inventor to walk through how it works.]`); } }, []);
  const proceed = () => { setData({ ...data, descriptionDiscussion: chat.messages.map(m => `${m.role}: ${m.content}`).join("\n") }); onNext(); };
  const ctx = `Title: ${data.patentTitle || "—"}\nField: ${data.patentField || "—"}\nSummary: ${data.summary || "—"}\nDescription: ${(data.descriptionDiscussion || "").substring(0, 1000)}`;
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Detailed Description</h2>
      <p style={ps.desc}>This is the heart of your patent. The AI will help you describe your invention in enough detail that someone in your field could reproduce it.</p>
      <ChatThread messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))} loading={chat.loading} onSend={msg => chat.send(msg)} placeholder="Describe how your invention works..." />
      {chat.messages.length > 5 && (<><button onClick={proceed} style={ps.nextBtn}>Next: Draft Claims →</button><NoveltyAdvisor data={data} context={ctx} onSave={(u) => setData({ ...data, ...u })} /></>)}
    </div>
  );
}

function ClaimsSection({ data, setData, onNext }) {
  const chat = useChat(`You are a patent claims drafting assistant at HAIIC.\nInvention: ${data.patentTitle}\nField: ${data.patentField}\nDescription: ${(data.descriptionDiscussion || "").substring(0, 2000)}\nHelp draft claims. Start broad, then 2-3 dependent claims. Use patent language and plain English side by side.`);
  const initialized = useRef(false);
  useEffect(() => { if (!initialized.current && chat.messages.length === 0) { initialized.current = true; chat.send(`[SYSTEM: Explain what patent claims are, then draft a broad independent claim for "${data.patentTitle}". Present in patent language and plain English.]`); } }, []);
  const proceed = () => { setData({ ...data, claimsDiscussion: chat.messages.map(m => `${m.role}: ${m.content}`).join("\n") }); onNext(); };
  const ctx = `Title: ${data.patentTitle || "—"}\nField: ${data.patentField || "—"}\nDescription: ${(data.descriptionDiscussion || "").substring(0, 600)}\nClaims: ${(data.claimsDiscussion || "").substring(0, 600)}`;
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Draft Patent Claims</h2>
      <p style={ps.desc}>Claims define exactly what your patent protects. The AI will help you draft them in proper legal language while explaining everything in plain English.</p>
      <ChatThread messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))} loading={chat.loading} onSend={msg => chat.send(msg)} placeholder="Review the claims and let me know what to adjust..." />
      {chat.messages.length > 4 && (<><button onClick={proceed} style={ps.nextBtn}>Generate Filing Package →</button><NoveltyAdvisor data={data} context={ctx} onSave={(u) => setData({ ...data, ...u })} /></>)}
    </div>
  );
}

function ReviewSection({ data, setData }) {
  const [document, setDocument] = useState(data.filingDocument || ""); const [loading, setLoading] = useState(!data.filingDocument); const [copied, setCopied] = useState(false);
  useEffect(() => { if (!data.filingDocument) generateDocument(); }, []);
  const generateDocument = async () => {
    setLoading(true);
    try {
      const bsCtx = data.brainstormBrief ? `\nBrainstorm Brief:\n${data.brainstormBrief.substring(0, 800)}` : "";
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: `Generate a complete provisional patent application for the USPTO:\n1. HEADER\n2. HAIIC BENEFIT-SHARING ACKNOWLEDGMENT\n3. TITLE OF THE INVENTION\n4. FIELD OF THE INVENTION\n5. BACKGROUND\n6. SUMMARY\n7. DETAILED DESCRIPTION\n8. CLAIMS\n9. ABSTRACT (150 words)\nWrite in formal patent language.`, messages: [{ role: "user", content: `Generate:\nInventor: ${data.inventorName}\nLocation: ${data.city}, ${data.state}, ${data.country}\nTitle: ${data.patentTitle}\nField: ${data.patentField}\nSummary: ${data.summary}${bsCtx}\nDescription: ${(data.descriptionDiscussion || "").substring(0, 2500)}\nClaims: ${(data.claimsDiscussion || "").substring(0, 2500)}` }], max_tokens: 4000 }) });
      const result = await res.json(); const text = result.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Unable to generate.";
      setDocument(text); setData(prev => ({ ...prev, filingDocument: text }));
    } catch { setDocument("Unable to generate document. Please try again."); } finally { setLoading(false); }
  };
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Filing Package</h2>
      <p style={ps.desc}>Here's your complete provisional patent application. Review carefully, then export or copy for filing with the USPTO.</p>
      {loading ? (<div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}><p>Generating your provisional patent application…</p><p style={{ fontSize: 13, marginTop: 8 }}>This may take a moment.</p></div>) : (
        <>
          <div style={ps.docCard}><pre style={ps.docText}>{document}</pre></div>
          <div style={ps.docActions}><button onClick={() => { navigator.clipboard.writeText(document); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={ps.copyBtn}>{copied ? "✓ Copied!" : "Copy to Clipboard"}</button></div>
          <div style={ps.nextSteps}><h3 style={ps.nextStepsTitle}>Next Steps</h3><p style={ps.nextStepsText}>1. Review the document carefully for accuracy.</p><p style={ps.nextStepsText}>2. File at the USPTO via EFS-Web (www.uspto.gov). Micro entity fee is approximately $80.</p><p style={ps.nextStepsText}>3. Your provisional patent gives you 12 months of "patent pending" status.</p><p style={ps.nextStepsText}>4. HAIIC will assist with commercialization under the benefit-sharing framework.</p></div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PatentForgePage() {
  const router = useRouter();
  const [user, setUser] = useState(null); const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("dashboard"); const [project, setProject] = useState(null); const [section, setSection] = useState(0); const [data, setData] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login?next=/patent-forge"); return; }
      setUser(session.user); setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/login?next=/patent-forge");
      else { setUser(session.user); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!project || authLoading) return;
    const timer = setTimeout(async () => { await supabase.from(TABLE).update({ section, data, updated_at: new Date().toISOString() }).eq("id", project.id); }, 800);
    return () => clearTimeout(timer);
  }, [section, data]);

  const handleSetData = (newData) => setData(newData);
  const goNext = () => setSection(s => Math.min(s + 1, SECTIONS.length - 1));
  const goToSection = (t) => { if (t < section) setSection(t); };
  const handleNew = (proj) => { setProject(proj); setSection(proj.section || 0); setData(proj.data || {}); setView("session"); };
  const handleResume = (proj) => { setProject(proj); setSection(proj.section || 0); setData(proj.data || {}); setView("session"); };
  const handleDashboard = async () => { if (project) await supabase.from(TABLE).update({ section, data, updated_at: new Date().toISOString() }).eq("id", project.id); setView("dashboard"); setProject(null); setSection(0); setData({}); };
  const handleSave = async () => { if (project) await supabase.from(TABLE).update({ section, data, updated_at: new Date().toISOString() }).eq("id", project.id); };
  const handleExport = () => { if (project) exportToDocx({ ...project, section, data }); };
  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  if (authLoading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#888", fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}>Loading…</div>;

  if (view === "dashboard") {
    return (
      <Layout title="Patent Forge" logoSrc="/patentforge-logo.png">
        <div style={styles.header}><p style={styles.label}>PATENT FORGE</p><h1 style={styles.heading}>Draft Your Provisional Patent</h1></div>
        <ProjectDashboard onNew={handleNew} onResume={handleResume} onSignOut={handleSignOut} userEmail={user?.email} />
      </Layout>
    );
  }

  return (
    <Layout title="Patent Forge" logoSrc="/patentforge-logo.png">
      <div style={styles.header}><p style={styles.label}>PATENT FORGE</p><h1 style={styles.heading}>Draft Your Provisional Patent</h1></div>
      <div style={tb.bar}>
        <button onClick={handleDashboard} style={tb.dashBtn}>← Projects</button>
        <div style={tb.projectName}>{project?.name || "Untitled"}</div>
        <div style={tb.actions}>
          <button onClick={handleSave} style={tb.btn}>💾 Save</button>
          <button onClick={handleExport} style={tb.btn}>⬇ Export .docx</button>
          <span style={tb.userEmail}>{user?.email}</span>
          <button onClick={handleSignOut} style={tb.signOutBtn}>Sign Out</button>
        </div>
      </div>
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
