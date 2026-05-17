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

const PHASE_DIVIDER_LABELS = {
  problem: "Defining the problem",
  explore: "Exploring root causes",
  ideate:  "Brainstorming solutions",
  refine:  "Refining the strongest idea",
  brief:   "Synthesizing the Invention Brief",
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT (phase-aware, defensive)
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt({ handle, profileSummary, intent, currentPhase, captures }) {
  const intentLine =
    intent === "idea"
      ? "They already have an idea and want help developing it."
      : intent === "problem"
      ? "They have a problem they want to solve but no solution yet."
      : "They're exploring — no fixed idea or problem yet.";

  const existingTypes = new Set((captures || []).map((c) => c.type));
  const completedPhases = ["problem", "explore", "ideate", "refine"].filter((p) => existingTypes.has(p));
  const completedLine =
    completedPhases.length === 0
      ? "None yet."
      : completedPhases.map((p) => p.toUpperCase()).join(", ");

  const phaseAfter = {
    intake:  "problem",
    problem: "explore",
    explore: "ideate",
    ideate:  "refine",
    refine:  "brief",
    brief:   "brief",
  };

  const phaseGuidance = {
    problem: `YOU ARE IN THE PROBLEM PHASE.
Your job: help the inventor clearly articulate what's broken, slow, or frustrating. Ask about who's affected, when it happens, what makes it worse.
PROPOSE A CAPTURE (type: problem) when the inventor has clearly described a problem worth solving — usually after 2-3 exchanges.
After the user approves a problem capture, you will be moved to the explore phase automatically.`,

    explore: `YOU ARE IN THE EXPLORE PHASE.
The problem is already captured. Do NOT propose another problem capture under any circumstances.
Your job now: dig into ROOT CAUSES. Ask about what's been tried before and why it failed, the hidden assumptions everyone makes about this problem, ripple effects (what other things go wrong because of this), and who else is affected that isn't obvious.
PROPOSE A CAPTURE (type: explore) when you've surfaced 2-3 substantive root causes or failed prior attempts.
After the user approves an explore capture, you will be moved to the ideate phase automatically.`,

    ideate: `YOU ARE IN THE IDEATE PHASE.
The problem and exploration are already captured. Do NOT propose another problem or explore capture under any circumstances.
Your job now: BRAINSTORM SOLUTIONS. Propose 3-4 diverse solution directions across a range — practical, ambitious, cross-industry/analogical, and one moonshot. Ask which resonate and why.
PROPOSE A CAPTURE (type: ideate) when 2-3 candidate solutions have been discussed substantively.
After the user approves an ideate capture, you will be moved to the refine phase automatically.`,

    refine: `YOU ARE IN THE REFINE PHASE.
The problem, exploration, and ideation are already captured. Do NOT propose any of those capture types again under any circumstances.
Your job now: help the inventor PICK THE STRONGEST IDEA and get specific about it. Push for concrete components, materials, mechanisms, dimensions, what makes it novel. The goal is enough specificity that someone in the field could reproduce it.
PROPOSE A CAPTURE (type: refine) when the strongest idea has been picked AND made concrete with technical specifics.
After the user approves a refine capture, an "Generate Invention Brief" button appears for them to synthesize the full brief.`,

    brief: `THE BRIEF HAS BEEN SYNTHESIZED. Your job now is to answer any follow-up questions the inventor has about the brief or what comes next. Do not propose more captures.`,
  };

  const captureSummary =
    captures.length === 0
      ? "No captures yet."
      : captures.map((c, i) => `${i + 1}. [${c.type.toUpperCase()}] ${c.title}: ${c.content.slice(0, 200)}`).join("\n");

  return `You are an innovation coach at HAIIC (Human-AI Innovation Commons) helping an inventor develop a patentable idea through a single continuous conversation.

══════════════════════════════════════════════════════════════
CRITICAL STATE — READ THIS FIRST
══════════════════════════════════════════════════════════════

CURRENT PHASE: ${currentPhase.toUpperCase()}
COMPLETED PHASES: ${completedLine}
NEXT PHASE AFTER CURRENT: ${phaseAfter[currentPhase] || "—"}

${phaseGuidance[currentPhase] || ""}

══════════════════════════════════════════════════════════════
THE INVENTOR
══════════════════════════════════════════════════════════════

Handle: ${handle}
${intentLine}

Background (from their profile):
${profileSummary || "No profile background available."}

══════════════════════════════════════════════════════════════
ALREADY CAPTURED — DO NOT RE-CAPTURE THESE
══════════════════════════════════════════════════════════════

${captureSummary}

You can reference these naturally if relevant, but never propose a capture for a type that's already in this list.

══════════════════════════════════════════════════════════════
CAPTURE MECHANISM
══════════════════════════════════════════════════════════════

When you've decided a capture moment has arrived per the rules above, end your message with a marker block exactly like this:

[CAPTURE_PROPOSED]
type: ${currentPhase}
title: A short headline-style title (5-10 words)
content: A 2-3 sentence summary in the inventor's voice, suitable for a sidebar card.
[/CAPTURE_PROPOSED]

The marker MUST use type: ${currentPhase === "intake" || currentPhase === "brief" ? "problem (this should not happen — see phase guidance)" : currentPhase}. Any other type is invalid and will be ignored.

The user sees your conversational response, then an inline "Capture this?" card with buttons. If they say Yes, the capture lands in the sidebar and you'll be moved to the next phase.

If you've ALREADY proposed a capture this turn (it's in the conversation history above) but the user is still asking questions or pushing back, do NOT propose it again. Engage with their pushback in normal prose.

══════════════════════════════════════════════════════════════
SPECIAL CASE — INSIGHT CAPTURES
══════════════════════════════════════════════════════════════

If the inventor reveals something durable and worth preserving that doesn't fit the main phase (a specific technical insight, a constraint, a personal context that shapes the work), you may propose:

[CAPTURE_PROPOSED]
type: insight
title: ...
content: ...
[/CAPTURE_PROPOSED]

These don't advance the phase. Use sparingly — once per session at most.

══════════════════════════════════════════════════════════════
LANE AWARENESS
══════════════════════════════════════════════════════════════

If the inventor drifts ahead (proposing solutions in the problem phase, etc.), gently park their idea — "Hold that thought, it'll fit better when we get to solutions" — and steer back to the current phase's work.

══════════════════════════════════════════════════════════════
STYLE
══════════════════════════════════════════════════════════════

- 2-3 short paragraphs per turn. No walls of text.
- Warm, direct, never condescending. Acknowledge insight specifically when it appears.
- Ask one good question at a time, not three.
- Use the inventor's handle naturally, not every message.
- When you propose a capture, write the conversational response first, then the marker. Don't preface the marker with "I'll capture this:" or similar — just write naturally and end with the marker block.

Continue the conversation now, working in the ${currentPhase.toUpperCase()} phase as described above.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE TRANSITION OPENER PROMPT
// Generates the AI's first message in a new phase after a capture is approved.
// ─────────────────────────────────────────────────────────────────────────────
function buildTransitionPrompt({ handle, fromPhase, toPhase, capturedTitle, capturedContent, captures }) {
  const opener = {
    explore: `The problem has just been captured. Now you're moving into the EXPLORE phase — root causes, failed prior attempts, hidden assumptions, ripple effects. Write a short message (2 short paragraphs max) that:
1. Briefly acknowledges what was just captured.
2. Names the shift: "Now let's dig into why this happens" or similar.
3. Asks one good opening question about root causes — what's been tried before, what assumptions everyone makes, who else is affected that isn't obvious.

Do NOT propose a capture in this message. Do NOT include the [CAPTURE_PROPOSED] marker.`,

    ideate: `The exploration has just been captured. Now you're moving into the IDEATE phase — brainstorming solutions. Write a short message (2-3 short paragraphs max) that:
1. Briefly acknowledges what was just captured.
2. Names the shift: "Now we're going to brainstorm some solutions" or similar.
3. Proposes 3-4 candidate solution directions across a range — practical, ambitious, cross-industry/analogical, and one moonshot. Make them concrete, not abstract.
4. Asks which one resonates.

Do NOT propose a capture in this message. Do NOT include the [CAPTURE_PROPOSED] marker.`,

    refine: `The brainstorming has just been captured. Now you're moving into the REFINE phase — picking the strongest idea and making it concrete. Write a short message (2 short paragraphs max) that:
1. Briefly acknowledges what was just captured.
2. Names the shift: "Now let's take the strongest of these and make it real" or similar.
3. Asks the inventor which idea felt strongest and starts pushing for specifics — components, materials, mechanisms.

Do NOT propose a capture in this message. Do NOT include the [CAPTURE_PROPOSED] marker.`,

    brief: `The refined invention has just been captured. The inventor will see a "Generate Invention Brief" button next. Write a short message (1-2 short paragraphs) that:
1. Acknowledges the refinement.
2. Tells the inventor they can synthesize the full Invention Brief whenever they're ready, or keep refining if they want.

Do NOT propose a capture in this message.`,
  };

  const instruction = opener[toPhase] || `Acknowledge the capture briefly and continue the conversation in the ${toPhase} phase.`;

  return `You are continuing an innovation coaching conversation with ${handle}. A capture was just approved and the phase has advanced from ${fromPhase} to ${toPhase}.

Just-captured artifact:
TITLE: ${capturedTitle}
CONTENT: ${capturedContent}

${instruction}

Tone: warm, direct, never condescending. Use the inventor's handle naturally if it fits.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE MARKER PARSING
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
// EXPORT — unified-chat .docx
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

  if (Array.isArray(data.messages) && data.messages.length > 0) {
    children.push(h2("Full Conversation"), spacer(60));
    for (const msg of data.messages) {
      if (!msg.content || msg.role === "divider") continue;
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
// LEGACY PROJECT VIEW
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
// INTAKE PHASE
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
      phase: 0,
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

  const [view, setView] = useState("dashboard");
  const [project, setProject] = useState(null);

  const [intent,         setIntent]         = useState(null);
  const [intakeUpdates,  setIntakeUpdates]  = useState("");
  const [messages,       setMessages]       = useState([]);
  const [captures,       setCaptures]       = useState([]);
  const [currentPhase,   setCurrentPhase]   = useState("intake");
  const [inventionBrief, setBrief]          = useState(null);
  const [pendingCapture, setPendingCapture] = useState(null);

  const [chatLoading, setChatLoading] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [justSaved,   setJustSaved]   = useState(false);

  const saveTimerRef = useRef(null);

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

  useEffect(() => {
    if (!project || authLoading || view !== "session") return;
    if (project?.data?.schema !== "unified-v1") return;

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await saveNow();
    }, 800);

    return () => clearTimeout(saveTimerRef.current);
  }, [messages, captures, currentPhase, intent, intakeUpdates, inventionBrief]);

  useEffect(() => {
    const handler = () => {
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

      // Strip divider messages from history before sending to API
      const apiMessages = nextMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: apiMessages,
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
        const allowed = proposal.type === currentPhase || proposal.type === "insight";
        const alreadyExists = captures.some((c) => c.type === proposal.type) && proposal.type !== "insight";
        if (allowed && !alreadyExists) {
          setPendingCapture({
            afterMsgIdx: finalMessages.length - 1,
            ...proposal,
          });
        }
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

  // Fires after capture approval to generate the AI's opening message for the new phase.
  const generatePhaseOpener = async (fromPhase, toPhase, capturedTitle, capturedContent, currentMessages, currentCaptures) => {
    if (!toPhase || toPhase === fromPhase || toPhase === "brief") return null;

    try {
      const transitionSystem = buildTransitionPrompt({
        handle,
        fromPhase,
        toPhase,
        capturedTitle,
        capturedContent,
        captures: currentCaptures,
      });

      // Pass the last few real messages for context (skip dividers)
      const recent = currentMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: transitionSystem,
          messages: recent.length > 0 ? recent : [{ role: "user", content: "Please open the next phase." }],
          max_tokens: 600,
        }),
      });

      const result = await res.json();
      const text = result.content?.map((i) => (i.type === "text" ? i.text : "")).join("\n") || "";
      // Strip any stray markers just in case
      return text.replace(/\[CAPTURE_PROPOSED\][\s\S]*?\[\/CAPTURE_PROPOSED\]/g, "").trim();
    } catch {
      return null;
    }
  };

  const approveCapture = async () => {
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

    const nextCaptures = [...captures, cap];
    setCaptures(nextCaptures);

    const fromPhase = currentPhase;
    const nextPhase = advancePhase(currentPhase, cap.type);
    const phaseChanged = nextPhase && nextPhase !== currentPhase;

    if (phaseChanged) setCurrentPhase(nextPhase);
    setPendingCapture(null);

    // If the phase changed, append a divider + a transition opener message
    if (phaseChanged) {
      const dividerMsg = {
        role: "divider",
        content: `${capLabel(cap.type)} captured. Now ${PHASE_DIVIDER_LABELS[nextPhase] || nextPhase}.`,
        timestamp: new Date().toISOString(),
      };
      // Insert divider immediately so the user gets a visual signal before the API call returns
      setMessages((prev) => [...prev, dividerMsg]);

      setChatLoading(true);
      const opener = await generatePhaseOpener(fromPhase, nextPhase, cap.title, cap.content, messages, nextCaptures);
      if (opener) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: opener,
          timestamp: new Date().toISOString(),
        }]);
      }
      setChatLoading(false);
    }
  };

  const dismissCapture = () => setPendingCapture(null);

  const generateBrief = async () => {
    setChatLoading(true);
    try {
      const captureText = captures.map((c) => `${c.type.toUpperCase()} — ${c.title}\n${c.content}`).join("\n\n");
      const convoText = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

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

  const showIntake = currentPhase === "intake";
  const canSynthesize = captures.some((c) => c.type === "refine") && !inventionBrief && currentPhase !== "brief";

  // Build the messages array we'll feed to ChatThread.
  // Divider messages get rendered as inline action nodes attached to the preceding message.
  const displayMessages = [];
  const inlineActions = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "divider") {
      // Attach divider to the previous message in displayMessages
      const attachIdx = displayMessages.length - 1;
      if (attachIdx >= 0) {
        inlineActions.push({
          afterMessageIdx: attachIdx,
          node: (
            <div key={`div-${i}`} style={dv.wrap}>
              <span style={dv.line} />
              <span style={dv.text}>{m.content}</span>
              <span style={dv.line} />
            </div>
          ),
        });
      }
    } else {
      displayMessages.push(m);
    }
  }

  // Pending-capture card attaches to the assistant message that proposed it.
  // We need to map the index in `messages` to the index in `displayMessages`.
  if (pendingCapture) {
    // Count how many non-divider messages exist up to and including pendingCapture.afterMsgIdx
    let displayIdx = -1;
    for (let i = 0; i <= pendingCapture.afterMsgIdx && i < messages.length; i++) {
      if (messages[i].role !== "divider") displayIdx++;
    }
    if (displayIdx >= 0) {
      inlineActions.push({
        afterMessageIdx: displayIdx,
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
                messages={displayMessages}
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

function advancePhase(current, captureType) {
  const captureToNextPhase = {
    problem: "explore",
    explore: "ideate",
    ideate:  "refine",
    refine:  "refine",
    brief:   "brief",
    insight: current,
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

function capLabel(type) {
  return labelForCaptureType(type);
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

const pg = {
  header: { marginBottom: 16 },
  label: { color: theme.red, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 },
  heading: { fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: theme.text },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  toolbarRight: { display: "flex", alignItems: "center", gap: 10 },
  backBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  userHandle: { fontSize: 13, color: theme.red, fontWeight: 700 },
  signOutBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  twoCol: { display: "flex", gap: 0, height: "72vh", border: `1px solid ${theme.border}`, borderRadius: 12, overflow: "hidden", background: "#101010" },
  leftCol: { flex: 1, padding: "0 18px", display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" },
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

const dv = {
  wrap: { display: "flex", alignItems: "center", gap: 12, margin: "14px 0", marginLeft: -38, paddingRight: 0 },
  line: { flex: 1, height: 1, background: theme.red, opacity: 0.3 },
  text: { fontSize: 11, fontWeight: 700, color: theme.red, textTransform: "uppercase", letterSpacing: 2, whiteSpace: "nowrap" },
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
