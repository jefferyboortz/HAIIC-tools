import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import Layout from "../components/Layout";
import ChatThread from "../components/ChatThread";
import BrainstormSidebar from "../components/BrainstormSidebar";
import theme from "../components/theme";

const TABLE = "brainstorm_projects";
const HANDOFF_KEY = "haiic_pf_handoff";

const PHASES = ["intake", "problem", "explore", "ideate", "refine", "brief"];

const INTENT_OPTIONS = [
  { value: "idea",    label: "I have an idea I want to develop" },
  { value: "problem", label: "I have a problem I want to solve but no solution yet" },
  { value: "curious", label: "I'm just curious — let's see what comes up" },
];

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// One unified prompt. The AI is phase-aware but the user never sees phase walls.
// AI emits [CAPTURE_PROPOSED]…[/CAPTURE_PROPOSED] markers at natural moments.
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt({ handle, profileSummary, intent, currentPhase, captures }) {
  const intentLine =
    intent === "idea"
      ? "They already have an idea and want help developing it. Start by hearing the idea."
      : intent === "problem"
      ? "They have a problem they want to solve but no solution yet. Help them articulate the problem clearly first."
      : "They're exploring — no fixed idea or problem yet. Help them discover what's worth working on.";

  const captureSummary =
    captures.length === 0
      ? "No captures yet."
      : captures
          .map((c, i) => `${i + 1}. ${c.type.toUpperCase()} — ${c.title}: ${c.content.slice(0, 200)}`)
          .join("\n");

  return `You are an innovation coach at HAIIC (Human-AI Innovation Commons) helping an inventor develop a patentable idea through a single continuous conversation.

THE INVENTOR
Handle: ${handle}
Background (from their profile):
${profileSummary || "No profile background available."}

Their intent for this session: ${intentLine}

THE PROCESS
The conversation moves through these phases, but you guide the transitions — the user doesn't see phase walls. They just see a conversation with you, with key moments captured into a sidebar for their reference.

Phases:
1. problem — define what's broken, slow, or frustrating
2. explore — dig into root causes, what's been tried, failure modes
3. ideate — brainstorm solutions across a range (practical → moonshot)
4. refine — pick the strongest idea and get specific (components, mechanisms, novelty)
5. brief — synthesize the Invention Brief

Current phase: ${currentPhase}

CAPTURE MECHANISM — THIS IS HOW THE PHASES ADVANCE
At natural moments (when the user has articulated something well, when a phase feels complete), propose a capture by ending your message with a marker block like this:

[CAPTURE_PROPOSED]
type: problem
title: Sensor drift causes assembly line stoppages
content: A 2-3 sentence summary of what the user has expressed, in their voice, ready to drop into a sidebar card.
[/CAPTURE_PROPOSED]

Valid types: problem, explore, ideate, refine, brief, insight

WHEN to propose a capture:
- problem: after the user has clearly described a problem worth solving (usually 2-3 messages in)
- explore: after root causes / failed prior attempts / hidden assumptions are surfaced
- ideate: after a meaningful set of 2-4 candidate solutions has been discussed
- refine: after the strongest idea has been picked and made concrete
- insight: any time the user reveals a specific durable insight that doesn't fit the main phases but is worth preserving
- brief: only after refine has been captured AND the user signals they're ready to synthesize

The user will see your written response, then an inline "Capture this?" card with [Yes] [Not yet] [Edit first] buttons. If they say Yes, the capture lands in the sidebar and the next phase begins.

LANE AWARENESS
If the user drifts ahead (proposing solutions in the problem phase, etc.), park the idea — "Hold that thought, it'll fit better when we get to solutions" — and steer back. Don't let them solve everything in phase 1.

If they jump ideas mid-conversation, follow their lead — but flag at natural moments: "We've got two threads going. Want to focus on X or Y first?"

EXISTING CAPTURES
${captureSummary}

Don't re-capture things that already exist. Don't reference them mechanically ("As captured in your problem statement…") — just be aware of them.

STYLE
- 2-3 short paragraphs per turn. No walls of text.
- Warm, direct, never condescending. Acknowledge insight specifically when it appears.
- Ask one good question at a time, not three.
- Use the inventor's handle naturally, not every message.
- When you propose a capture, write the conversational response first, then the marker. Don't preface the marker.

Begin or continue the conversation now.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE MARKER PARSING
// Extract [CAPTURE_PROPOSED]…[/CAPTURE_PROPOSED] blocks from AI messages.
// Returns { visible: textWithoutMarker, proposal: {type,title,content} | null }
// ─────────────────────────────────────────────────────────────────────────────
function parseCaptureMarker(text) {
  if (!text) return { visible: text, proposal: null };
  const match = text.match(/\[CAPTURE_PROPOSED\]([\s\S]*?)\[\/CAPTURE_PROPOSED\]/);
  if (!match) return { visible: text, proposal: null };

  const block = match[1];
  const typeMatch    = block.match(/type:\s*(\w+)/i);
  const titleMatch   = block.match(/title:\s*(.+)/i);
  const contentMatch = block.match(/content:\s*([\s\S]+?)(?=\n\s*(?:type|title):|$)/i);

  if (!typeMatch || !titleMatch || !contentMatch) {
    return { visible: text.replace(match[0], "").trim(), proposal: null };
  }

  const proposal = {
    type:    typeMatch[1].trim().toLowerCase(),
    title:   titleMatch[1].trim(),
    content: contentMatch[1].trim(),
  };

  const visible = text.replace(match[0], "").trim();
  return { visible, proposal };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — unified-chat .docx (simpler than the old per-phase version)
// ─────────────────────────────────────────────────────────────────────────────
async function exportToDocx(project, handle) {
  const { name, data } = project;
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    BorderStyle, Header, Footer, PageNumber, TabStopType, TabStopPosition,
  } = await import("docx");

  const RED = "C0392B", GRAY = "666666", BLACK = "1A1A1A";

  const spacer = (sz = 120) => new Paragraph({ children: [new TextRun("")], spacing: { after: sz } });
  const h2 = (text) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } },
    children: [new TextRun({ text, color: RED, bold: true, font: "Arial", size: 26 })],
  });
  const p = (text, opts = {}) => new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: GRAY, ...opts })],
  });

  const children = [];

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({
        text: "HUMAN-AI INNOVATION COMMONS",
        font: "Arial", size: 18, bold: true, color: RED, allCaps: true,
      })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
      children: [new TextRun({
        text: name || "Brainstorm Session",
        font: "Arial", size: 40, bold: true, color: BLACK,
      })],
    }),
    p(`Inventor: ${handle || "—"}`),
    p(`Exported: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`),
    spacer(240),
  );

  // Captures section
  if (Array.isArray(data.captures) && data.captures.length > 0) {
    children.push(h2("Captured Artifacts"), spacer(60));
    for (const cap of data.captures) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({
            text: `${cap.type.toUpperCase()} — ${cap.title}`,
            font: "Arial", size: 22, bold: true, color: BLACK,
          })],
        }),
        p(cap.content),
        spacer(80),
      );
    }
  }

  // Full conversation
  if (Array.isArray(data.messages) && data.messages.length > 0) {
    children.push(h2("Full Conversation"), spacer(60));
    for (const msg of data.messages) {
      if (!msg.content) continue;
      const role = msg.role === "assistant" ? "AI Coach" : "You";
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: `${role}:  `,
              bold: true,
              color: msg.role === "assistant" ? RED : BLACK,
              font: "Arial",
              size: 20,
            }),
            new TextRun({ text: msg.content, font: "Arial", size: 20, color: GRAY }),
          ],
        }),
      );
    }
  }

  // Brief if synthesized
  if (data.inventionBrief) {
    children.push(
      new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }),
      h2("Invention Brief"),
      spacer(60),
      ...data.inventionBrief.split("\n").map((line) =>
        new Paragraph({
          spacing: { after: line.trim() === "" ? 120 : 40 },
          children: [new TextRun({ text: line, font: "Arial", size: 20, color: GRAY })],
        }),
      ),
    );
  }

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
          paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } },
        children: [
          new TextRun({ text: "HAIIC Brainstorm", font: "Arial", size: 18, color: RED, bold: true }),
          new TextRun({ text: "\tapps-haiic.com", font: "Arial", size: 18, color: GRAY }),
        ],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: "Human-AI Innovation Commons  ·  Co-authored with Claude", font: "Arial", size: 16, color: GRAY }),
          new TextRun({ children: ["\t", PageNumber.CURRENT], font: "Arial", size: 16, color: GRAY }),
        ],
      })] }) },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `HAIIC-Brainstorm-${(name || "session").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY PROJECT VIEW — read-only display + delete button
// ─────────────────────────────────────────────────────────────────────────────
function LegacyView({ project, onBack, onDelete }) {
  const data = project?.data || {};
  return (
    <div style={lv.wrap}>
      <div style={lv.toolbar}>
        <button onClick={onBack} style={lv.backBtn}>← Projects</button>
        <div style={lv.title}>{project.name} (legacy format)</div>
        <button onClick={() => onDelete(project.id, project.name)} style={lv.deleteBtn}>Delete</button>
      </div>
      <div style={lv.notice}>
        This project was created before the unified-chat rewrite. It's read-only —
        the new architecture creates projects in a different shape. If you'd like to
        continue the work, copy what you need and start a fresh project.
      </div>
      <div style={lv.body}>
        {data.field && <p><strong>Field:</strong> {data.field}</p>}
        {data.role && <p><strong>Role:</strong> {data.role}</p>}
        {data.insight && <p><strong>Insight:</strong> {data.insight}</p>}
        {["problemDiscussion", "deepenDiscussion", "ideationDiscussion", "refineDiscussion"].map((key) => {
          if (!data[key]) return null;
          return (
            <div key={key} style={{ marginTop: 16 }}>
              <p style={lv.sectionTitle}>{key.replace("Discussion", "")}</p>
              <pre style={lv.transcript}>{data[key]}</pre>
            </div>
          );
        })}
        {data.inventionBrief && (
          <div style={{ marginTop: 16 }}>
            <p style={lv.sectionTitle}>Invention Brief</p>
            <pre style={lv.transcript}>{data.inventionBrief}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTAKE PHASE — short form: "anything changed?" + "what brings you here?"
// ─────────────────────────────────────────────────────────────────────────────
function IntakePhase({ handle, profileSummary, onStart }) {
  const [intent, setIntent] = useState(null);
  const [updates, setUpdates] = useState("");

  return (
    <div style={ip.wrap}>
      <h2 style={ip.heading}>Welcome back, {handle || "there"}.</h2>
      <p style={ip.subhead}>
        I've got your profile loaded. Anything changed about your background since last time?
        Skip if not — totally optional.
      </p>

      {profileSummary && (
        <details style={ip.profileWrap}>
          <summary style={ip.profileToggle}>See what I have on you</summary>
          <pre style={ip.profilePre}>{profileSummary}</pre>
        </details>
      )}

      <textarea
        style={ip.textarea}
        rows={3}
        placeholder="Anything new I should know? (Optional)"
        value={updates}
        onChange={(e) => setUpdates(e.target.value)}
      />

      <p style={ip.label}>What brings you here today?</p>
      {INTENT_OPTIONS.map((opt) => (
        <label key={opt.value} style={{
          ...ip.radioRow,
          background: intent === opt.value ? theme.surfaceAlt : "transparent",
          borderColor: intent === opt.value ? theme.red : theme.border,
        }}>
          <input
            type="radio"
            name="intent"
            value={opt.value}
            checked={intent === opt.value}
            onChange={() => setIntent(opt.value)}
            style={ip.radio}
          />
          <span style={ip.radioLabel}>{opt.label}</span>
        </label>
      ))}

      <button
        onClick={() => onStart({ intent, updates: updates.trim() })}
        disabled={!intent}
        style={{ ...ip.startBtn, opacity: intent ? 1 : 0.4, cursor: intent ? "pointer" : "not-allowed" }}
      >
        Start the conversation →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function ProjectDashboard({ onNew, onResume, onSignOut, handle, onOpenLegacy }) {
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
    const project = {
      id: genId(),
      user_id: user.id,
      name,
      phase: 0, // legacy field, ignored by new architecture
      data: {
        schema: "unified-v1",
        currentPhase: "intake",
        intent: null,
        intakeUpdates: "",
        messages: [],
        captures: [],
        inventionBrief: null,
      },
    };
    await supabase.from(TABLE).insert(project);
    setNewName("");
    onNew(project);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await supabase.from(TABLE).delete().eq("id", id);
    setProjects((p) => p.filter((x) => x.id !== id));
  };

  const handleRename = async (id) => {
    const p = projects.find((p) => p.id === id);
    const n = prompt("Rename project:", p.name);
    if (!n?.trim()) return;
    await supabase.from(TABLE).update({ name: n.trim(), updated_at: new Date().toISOString() }).eq("id", id);
    setProjects((prev) => prev.map((x) => (x.id === id ? { ...x, name: n.trim() } : x)));
  };

  const isLegacy = (p) => p?.data?.schema !== "unified-v1";

  return (
    <div style={db.wrap}>
      <div style={db.topRow}>
        <h2 style={db.title}>Your Brainstorm Projects</h2>
        <div style={db.userRow}>
          <span style={db.userHandle}>{handle}</span>
          <button onClick={onSignOut} style={db.signOutBtn}>Sign Out</button>
        </div>
      </div>
      <p style={db.desc}>Each project saves automatically — resume from any device, any time.</p>

      <div style={db.newRow}>
        <input
          style={db.input}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleNew()}
          placeholder="Name your invention idea (optional)..."
        />
        <button onClick={handleNew} style={db.startBtn}>Start New Project →</button>
      </div>

      {loading && <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading your projects…</p>}

      {!loading && projects.length > 0 && (
        <div style={db.list}>
          <p style={db.listHeader}>SAVED PROJECTS ({projects.length})</p>
          {projects.map((p) => (
            <div key={p.id} style={db.card}>
              <div style={db.cardLeft}>
                <div style={db.cardName}>
                  {p.name}
                  {isLegacy(p) && <span style={db.legacyTag}>legacy</span>}
                </div>
                <div style={db.cardMeta}>
                  Last saved {new Date(p.updated_at).toLocaleString()}
                </div>
              </div>
              <div style={db.cardRight}>
                {isLegacy(p) ? (
                  <button onClick={() => onOpenLegacy(p)} style={db.resumeBtn}>View →</button>
                ) : (
                  <button onClick={() => onResume(p)} style={db.resumeBtn}>Resume →</button>
                )}
                <button onClick={() => handleRename(p.id)} style={db.iconBtn} title="Rename">✏</button>
                <button onClick={() => handleDelete(p.id, p.name)} style={db.iconBtn} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div style={db.empty}>No saved projects yet. Start your first invention above.</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BRAINSTORM PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function BrainstormPage() {
  const router = useRouter();

  const [user, setUser]               = useState(null);
  const [handle, setHandle]           = useState("");
  const [profileSummary, setSummary]  = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  const [view, setView] = useState("dashboard"); // dashboard | session | legacy
  const [project, setProject] = useState(null);

  // Project session state — derived from project.data and synced back to Supabase
  const [intent,         setIntent]         = useState(null);
  const [intakeUpdates,  setIntakeUpdates]  = useState("");
  const [messages,       setMessages]       = useState([]);
  const [captures,       setCaptures]       = useState([]);
  const [currentPhase,   setCurrentPhase]   = useState("intake");
  const [inventionBrief, setBrief]          = useState(null);
  const [pendingCapture, setPendingCapture] = useState(null); // {afterMsgIdx, type, title, content}

  const [chatLoading, setChatLoading] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [justSaved,   setJustSaved]   = useState(false);

  const saveTimerRef = useRef(null);

  // ── Auth + profile ────────────────────────────────────────────────────────
  useEffect(() => {
    const loadProfile = async (userId) => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name, profile_categories")
        .eq("user_id", userId)
        .maybeSingle();
      setHandle((profile?.name || "").trim() || "Inventor");
      setSummary(buildProfileSummary(profile?.profile_categories || {}));
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login?next=/brainstorm"); return; }
      setUser(session.user);
      loadProfile(session.user.id);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/login?next=/brainstorm");
      else { setUser(session.user); loadProfile(session.user.id); setAuthLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Auto-save (debounced 800ms) ───────────────────────────────────────────
  useEffect(() => {
    if (!project || authLoading || view !== "session") return;
    if (project?.data?.schema !== "unified-v1") return;

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await saveNow();
    }, 800);

    return () => clearTimeout(saveTimerRef.current);
  }, [messages, captures, currentPhase, intent, intakeUpdates, inventionBrief]);

  // ── beforeunload flush — make sure the last keystroke saves ───────────────
  useEffect(() => {
    const handler = () => {
      // Best-effort synchronous save trigger; the actual write may not complete
      // before unload, but auto-save runs every 800ms during typing so the gap
      // is small. This is here so the LAST keystroke / message has a chance.
      if (project && view === "session" && project?.data?.schema === "unified-v1") {
        saveNow();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [project, view, messages, captures, currentPhase, intent, intakeUpdates, inventionBrief]);

  const saveNow = async () => {
    if (!project) return;
    setSaving(true);
    const newData = {
      schema: "unified-v1",
      currentPhase,
      intent,
      intakeUpdates,
      messages,
      captures,
      inventionBrief,
    };
    await supabase
      .from(TABLE)
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  // ── Send a message to Claude ──────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text || chatLoading) return;

    const newUserMsg = { role: "user", content: text, timestamp: new Date().toISOString() };
    const nextMessages = [...messages, newUserMsg];
    setMessages(nextMessages);
    setPendingCapture(null);
    setChatLoading(true);

    try {
      const system = buildSystemPrompt({
        handle,
        profileSummary: [profileSummary, intakeUpdates ? `Recent updates from this session: ${intakeUpdates}` : ""].filter(Boolean).join("\n\n"),
        intent,
        currentPhase,
        captures,
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: 1200,
        }),
      });

      const result = await res.json();
      const rawText = result.content?.map((i) => (i.type === "text" ? i.text : "")).join("\n") || "I'm sorry, something went wrong. Try sending that again.";

      const { visible, proposal } = parseCaptureMarker(rawText);

      const assistantMsg = {
        role: "assistant",
        content: visible,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);

      if (proposal) {
        // Attach to the assistant message we just added
        setPendingCapture({
          afterMsgIdx: finalMessages.length - 1,
          ...proposal,
        });
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "I'm sorry, something went wrong reaching the AI. Try sending that again.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [messages, chatLoading, handle, profileSummary, intent, currentPhase, captures, intakeUpdates]);

  // ── Capture approval / dismissal ──────────────────────────────────────────
  const approveCapture = () => {
    if (!pendingCapture) return;
    const cap = {
      id: genId(),
      type: pendingCapture.type,
      title: pendingCapture.title,
      content: pendingCapture.content,
      approved: true,
      createdAt: new Date().toISOString(),
      sourceMsgIdx: pendingCapture.afterMsgIdx,
    };
    setCaptures((prev) => [...prev, cap]);

    // Advance the phase
    const nextPhase = advancePhase(currentPhase, cap.type);
    if (nextPhase) setCurrentPhase(nextPhase);

    setPendingCapture(null);
  };

  const dismissCapture = () => setPendingCapture(null);

  // ── Brief synthesis (final phase) ─────────────────────────────────────────
  const generateBrief = async () => {
    setChatLoading(true);
    try {
      const captureText = captures.map((c) => `${c.type.toUpperCase()} — ${c.title}\n${c.content}`).join("\n\n");
      const convoText = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `Synthesize a structured Invention Brief from the inventor's conversation and captured artifacts. Format:

INVENTION BRIEF
===============
Title: [title]
Field: [technical field]
Inventor: ${handle}

PROBLEM STATEMENT
[2-3 sentences]

PROPOSED SOLUTION
[2-3 paragraphs]

KEY COMPONENTS
[bullet list]

NOVELTY FACTORS
[what makes it different from existing solutions]

TARGET USERS
[who and why]

RECOMMENDED NEXT STEP
This Invention Brief is ready to be taken into Patent Forge.`,
          messages: [{ role: "user", content: `Captures:\n${captureText}\n\nConversation:\n${convoText}` }],
          max_tokens: 2000,
        }),
      });

      const result = await res.json();
      const text = result.content?.map((i) => (i.type === "text" ? i.text : "")).join("\n") || "Unable to synthesize brief.";
      setBrief(text);
      setCurrentPhase("brief");
    } catch {
      setBrief("Unable to generate brief. Please try again.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleTakeToForge = () => {
    if (!inventionBrief) return;
    try {
      const titleMatch = inventionBrief.match(/Title:\s*(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : project?.name || "";
      const fieldMatch = inventionBrief.match(/Field:\s*(.+)/);
      const field = fieldMatch ? fieldMatch[1].trim() : "";
      localStorage.setItem(HANDOFF_KEY, JSON.stringify({
        name: project?.name || title || "Brainstorm Import",
        patentTitle: title,
        patentField: field,
        field,
        inventionBrief,
        timestamp: new Date().toISOString(),
      }));
    } catch {}
    window.location.href = "/patent-forge";
  };

  // ── Navigation handlers ───────────────────────────────────────────────────
  const handleNew = (proj) => {
    setProject(proj);
    setCurrentPhase("intake");
    setIntent(null);
    setIntakeUpdates("");
    setMessages([]);
    setCaptures([]);
    setBrief(null);
    setPendingCapture(null);
    setView("session");
  };

  const handleResume = (proj) => {
    const d = proj.data || {};
    setProject(proj);
    setCurrentPhase(d.currentPhase || "intake");
    setIntent(d.intent || null);
    setIntakeUpdates(d.intakeUpdates || "");
    setMessages(Array.isArray(d.messages) ? d.messages : []);
    setCaptures(Array.isArray(d.captures) ? d.captures : []);
    setBrief(d.inventionBrief || null);
    setPendingCapture(null);
    setView("session");
  };

  const handleOpenLegacy = (proj) => {
    setProject(proj);
    setView("legacy");
  };

  const handleBackToDashboard = async () => {
    if (view === "session" && project?.data?.schema === "unified-v1") {
      await saveNow();
    }
    setView("dashboard");
    setProject(null);
    setMessages([]);
    setCaptures([]);
    setIntent(null);
    setBrief(null);
    setPendingCapture(null);
  };

  const handleDeleteLegacy = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await supabase.from(TABLE).delete().eq("id", id);
    setView("dashboard");
    setProject(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleStartConversation = ({ intent: chosenIntent, updates }) => {
    setIntent(chosenIntent);
    setIntakeUpdates(updates);
    setCurrentPhase("problem");
    // Kick off the conversation with a system-only opening turn
    const opener =
      chosenIntent === "idea"
        ? "Tell me about your idea — what is it, and what made you start thinking about it?"
        : chosenIntent === "problem"
        ? "Tell me about the problem on your mind — what's frustrating, broken, or slow that you'd like to solve?"
        : "Let's start broad. What's been on your mind lately — something you've been noticing, frustrated by, or curious about?";

    setMessages([{
      role: "assistant",
      content: `Hi ${handle}. ${opener}`,
      timestamp: new Date().toISOString(),
    }]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#888", fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}>
        Loading…
      </div>
    );
  }

  if (view === "dashboard") {
    return (
      <Layout title="Brainstorm" logoSrc="/brainstorm-logo.png">
        <div style={pg.header}>
          <p style={pg.label}>BRAINSTORM</p>
          <h1 style={pg.heading}>Discover Your Next Invention</h1>
        </div>
        <ProjectDashboard
          onNew={handleNew}
          onResume={handleResume}
          onSignOut={handleSignOut}
          onOpenLegacy={handleOpenLegacy}
          handle={handle}
        />
      </Layout>
    );
  }

  if (view === "legacy") {
    return (
      <Layout title="Brainstorm" logoSrc="/brainstorm-logo.png">
        <LegacyView
          project={project}
          onBack={handleBackToDashboard}
          onDelete={handleDeleteLegacy}
        />
      </Layout>
    );
  }

  // view === "session"
  const showIntake = currentPhase === "intake";
  const canSynthesize = captures.some((c) => c.type === "refine") && !inventionBrief && currentPhase !== "brief";

  // Build inlineActions for ChatThread
  const inlineActions = [];
  if (pendingCapture) {
    inlineActions.push({
      afterMessageIdx: pendingCapture.afterMsgIdx,
      node: (
        <div style={cc.card}>
          <div style={cc.cardHead}>Capture this as your {labelForCaptureType(pendingCapture.type)}?</div>
          <div style={cc.cardTitle}>{pendingCapture.title}</div>
          <div style={cc.cardContent}>{pendingCapture.content}</div>
          <div style={cc.cardButtons}>
            <button onClick={approveCapture} style={cc.approveBtn}>Yes, save it</button>
            <button onClick={dismissCapture} style={cc.dismissBtn}>Not yet</button>
          </div>
        </div>
      ),
    });
  }

  return (
    <Layout title="Brainstorm" logoSrc="/brainstorm-logo.png">
      <div style={pg.header}>
        <p style={pg.label}>BRAINSTORM</p>
        <h1 style={pg.heading}>{project?.name || "Untitled"}</h1>
      </div>

      <div style={pg.toolbar}>
        <button onClick={handleBackToDashboard} style={pg.backBtn}>← Projects</button>
        <div style={pg.toolbarRight}>
          <span style={pg.userHandle}>{handle}</span>
          <button onClick={handleSignOut} style={pg.signOutBtn}>Sign Out</button>
        </div>
      </div>

      <div style={pg.twoCol}>
        <div style={pg.leftCol}>
          {showIntake ? (
            <IntakePhase
              handle={handle}
              profileSummary={profileSummary}
              onStart={handleStartConversation}
            />
          ) : inventionBrief ? (
            <div style={br.wrap}>
              <h2 style={br.title}>Your Invention Brief</h2>
              <div style={br.card}><pre style={br.text}>{inventionBrief}</pre></div>
              <div style={br.actions}>
                <button onClick={() => { navigator.clipboard.writeText(inventionBrief); }} style={br.copyBtn}>
                  Copy to Clipboard
                </button>
                <button onClick={handleTakeToForge} style={br.forgeBtn}>Take to Patent Forge →</button>
              </div>
            </div>
          ) : (
            <>
              <ChatThread
                messages={messages}
                loading={chatLoading}
                onSend={sendMessage}
                placeholder="Type a message…"
                inlineActions={inlineActions}
              />
              {canSynthesize && (
                <div style={pg.synthBar}>
                  <p style={pg.synthText}>Ready to synthesize what we have into an Invention Brief?</p>
                  <button onClick={generateBrief} style={pg.synthBtn}>Generate Invention Brief →</button>
                </div>
              )}
            </>
          )}
        </div>

        <BrainstormSidebar
          currentPhase={currentPhase}
          captures={captures}
          onSave={saveNow}
          onExport={() => exportToDocx({ ...project, data: { schema: "unified-v1", currentPhase, intent, intakeUpdates, messages, captures, inventionBrief } }, handle)}
          saving={saving}
          justSaved={justSaved}
        />
      </div>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function advancePhase(current, captureType) {
  // Phase advances to the phase AFTER the captured one
  const captureToNextPhase = {
    problem: "explore",
    explore: "ideate",
    ideate:  "refine",
    refine:  "refine", // stay in refine until brief is synthesized
    brief:   "brief",
    insight: current, // insights don't advance the phase
  };
  return captureToNextPhase[captureType] || current;
}

function labelForCaptureType(type) {
  const map = {
    problem: "Problem Statement",
    explore: "Root Causes",
    ideate:  "Idea Set",
    refine:  "Refined Invention",
    brief:   "Invention Brief",
    insight: "Insight",
  };
  return map[type] || "Capture";
}

function buildProfileSummary(categories) {
  if (!categories) return "";
  const labels = {
    work: "Work",
    education: "Education",
    skills: "Skills",
    hobbies: "Hobbies",
    passions: "Passions",
    lived_experience: "Lived experience",
    values_worldview: "Values & worldview",
  };
  const lines = [];
  for (const key of Object.keys(labels)) {
    const v = (categories[key] || "").trim();
    if (v) lines.push(`${labels[key]}: ${v}`);
  }
  return lines.join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const pg = {
  header: { marginBottom: 16 },
  label: { color: theme.red, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 },
  heading: { fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: theme.text },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  toolbarRight: { display: "flex", alignItems: "center", gap: 10 },
  backBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  userHandle: { fontSize: 13, color: theme.red, fontWeight: 700 },
  signOutBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  twoCol: { display: "flex", gap: 0, minHeight: "60vh", border: `1px solid ${theme.border}`, borderRadius: 12, overflow: "hidden", background: "#101010" },
  leftCol: { flex: 1, padding: "0 18px", display: "flex", flexDirection: "column", minWidth: 0 },
  synthBar: { borderTop: `1px solid ${theme.border}`, padding: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  synthText: { fontSize: 13, color: theme.textMuted, margin: 0 },
  synthBtn: { background: theme.red, border: "none", borderRadius: 7, color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};

const cc = {
  card: { background: theme.surface, border: `1px solid ${theme.red}`, borderRadius: 8, padding: "12px 14px", maxWidth: 520 },
  cardHead: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: theme.red, textTransform: "uppercase", marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 6 },
  cardContent: { fontSize: 13, color: theme.textMuted, lineHeight: 1.5, marginBottom: 12 },
  cardButtons: { display: "flex", gap: 8 },
  approveBtn: { background: theme.red, border: "none", borderRadius: 6, color: "#fff", padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  dismissBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};

const ip = {
  wrap: { padding: "20px 0", maxWidth: 560 },
  heading: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: theme.text, marginBottom: 8 },
  subhead: { fontSize: 14, color: theme.textMuted, lineHeight: 1.6, marginBottom: 16 },
  profileWrap: { marginBottom: 14 },
  profileToggle: { fontSize: 12, color: theme.red, fontWeight: 600, cursor: "pointer" },
  profilePre: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, fontSize: 12, color: theme.textMuted, whiteSpace: "pre-wrap", marginTop: 8, fontFamily: "'DM Sans', sans-serif" },
  textarea: { width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 18 },
  label: { fontSize: 13, fontWeight: 600, color: theme.textMuted, marginBottom: 8 },
  radioRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid", borderRadius: 8, marginBottom: 8, cursor: "pointer" },
  radio: { accentColor: theme.red },
  radioLabel: { fontSize: 14, color: theme.text },
  startBtn: { background: theme.red, border: "none", borderRadius: 8, color: "#fff", padding: "12px 24px", fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginTop: 12 },
};

const db = {
  wrap: { marginTop: 8 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: theme.text, margin: 0 },
  userRow: { display: "flex", alignItems: "center", gap: 10 },
  userHandle: { fontSize: 13, color: theme.red, fontWeight: 700 },
  signOutBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  desc: { fontSize: 14, color: theme.textMuted, lineHeight: 1.6, marginBottom: 20 },
  newRow: { display: "flex", gap: 12, marginBottom: 28, alignItems: "center", flexWrap: "wrap" },
  input: { flex: 1, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", minWidth: 220 },
  startBtn: { background: theme.red, border: "none", borderRadius: 8, color: "#fff", padding: "12px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  listHeader: { fontSize: 11, fontWeight: 700, letterSpacing: 2, color: theme.textDim, textTransform: "uppercase", marginBottom: 4 },
  card: { display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "14px 18px", gap: 12, flexWrap: "wrap" },
  cardLeft: { flex: 1, minWidth: 200 },
  cardName: { fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: theme.textDim },
  cardRight: { display: "flex", gap: 8, alignItems: "center" },
  resumeBtn: { background: theme.red, border: "none", borderRadius: 7, color: "#fff", padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  iconBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 7, color: theme.textMuted, padding: "7px 10px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  empty: { textAlign: "center", padding: "40px 20px", color: theme.textDim, fontSize: 14, border: `1px dashed ${theme.border}`, borderRadius: 10 },
  legacyTag: { background: theme.surfaceAlt, color: theme.textDim, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, marginLeft: 8, verticalAlign: "middle", textTransform: "uppercase", letterSpacing: 1 },
};

const lv = {
  wrap: { marginTop: 8 },
  toolbar: { display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, marginBottom: 16, flexWrap: "wrap" },
  backBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  title: { flex: 1, fontSize: 14, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  deleteBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  notice: { background: "#2a2419", border: "1px solid #4a4019", borderRadius: 8, color: "#d4b87a", padding: "12px 16px", fontSize: 13, lineHeight: 1.6, marginBottom: 16 },
  body: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "16px 20px", color: theme.textMuted, fontSize: 13, lineHeight: 1.7 },
  sectionTitle: { color: theme.red, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 8, marginBottom: 6 },
  transcript: { whiteSpace: "pre-wrap", fontSize: 13, color: theme.textMuted, fontFamily: "'DM Sans', sans-serif", margin: 0 },
};

const br = {
  wrap: { padding: "20px 0" },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: theme.text, marginBottom: 12 },
  card: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24, marginBottom: 16 },
  text: { fontSize: 13, lineHeight: 1.7, color: "#ccc", fontFamily: "'DM Sans', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 },
  actions: { display: "flex", gap: 12, flexWrap: "wrap" },
  copyBtn: { padding: "12px 20px", background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.textMuted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  forgeBtn: { padding: "12px 20px", background: theme.red, border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};
