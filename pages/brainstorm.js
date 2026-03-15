import { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import ChatThread from "../components/ChatThread";
import useChat from "../components/useChat";
import theme from "../components/theme";

// ─── Phase Definitions ────────────────────────────────────────────────────────

const PHASES = [
  { id: "welcome",  label: "Welcome",         icon: "💡" },
  { id: "domain",   label: "Your Expertise",  icon: "①" },
  { id: "problem",  label: "Define Problem",  icon: "②" },
  { id: "deepen",   label: "Explore",         icon: "③" },
  { id: "ideate",   label: "Brainstorm",      icon: "④" },
  { id: "refine",   label: "Refine",          icon: "⑤" },
  { id: "summary",  label: "Invention Brief", icon: "★" },
];

// ─── localStorage Helpers ─────────────────────────────────────────────────────

const PROJECTS_KEY = "haiic_bs_projects";

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

// ─── Export Utility (.docx) ───────────────────────────────────────────────────

async function exportToDocx(project) {
  const { name, data, phase } = project;

  // Dynamic import — avoids SSR issues in Next.js
  const {
    Document, Packer, Paragraph, TextRun,
    HeadingLevel, AlignmentType, BorderStyle,
    Header, Footer, PageNumber, TabStopType, TabStopPosition,
  } = await import("docx");

  const RED   = "C0392B";
  const GRAY  = "666666";
  const BLACK = "1A1A1A";

  // ── Helpers ────────────────────────────────────────────────────────────────

  const spacer = () => new Paragraph({ children: [new TextRun("")], spacing: { after: 80 } });

  const sectionHeading = (text) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } },
    children: [new TextRun({ text, color: RED, bold: true, font: "Arial", size: 26 })],
  });

  // Render chat discussion text — strip [SYSTEM:…] lines, style role labels
  const renderDiscussion = (raw) => {
    if (!raw) return [];
    return raw.split("\n").flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("[SYSTEM:")) return [];
      const isAssistant = trimmed.startsWith("assistant:");
      const isUser      = trimmed.startsWith("user:");
      const roleLabel   = isAssistant ? "AI Coach" : isUser ? "You" : null;
      const body        = roleLabel ? trimmed.slice(trimmed.indexOf(":") + 1).trim() : trimmed;
      return [
        new Paragraph({
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
        }),
      ];
    });
  };

  // ── Document sections ──────────────────────────────────────────────────────

  const children = [];

  // Cover block
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
        text: name || "Invention Session",
        font: "Arial", size: 40, bold: true, color: BLACK,
      })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({
        text: `Brainstorm Session  ·  Exported ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        font: "Arial", size: 20, color: GRAY,
      })],
    }),
    new Paragraph({
      spacing: { after: 320 },
      children: [new TextRun({
        text: `Progress: ${PHASES[phase]?.label || "Complete"}`,
        font: "Arial", size: 20, color: GRAY, italics: true,
      })],
    }),
  );

  // Expertise
  if (data.field || data.role || data.insight) {
    children.push(sectionHeading("Your Expertise"), spacer());
    if (data.field) children.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Field / Industry:  ", bold: true, font: "Arial", size: 20, color: BLACK }),
        new TextRun({ text: data.field, font: "Arial", size: 20, color: GRAY }),
      ],
    }));
    if (data.role) children.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Role / Specialty:  ", bold: true, font: "Arial", size: 20, color: BLACK }),
        new TextRun({ text: data.role, font: "Arial", size: 20, color: GRAY }),
      ],
    }));
    if (data.insight) {
      children.push(
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Insider Knowledge:", bold: true, font: "Arial", size: 20, color: BLACK })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: data.insight, font: "Arial", size: 20, color: GRAY })] }),
      );
    }
  }

  // Phase discussions
  const sections = [
    { key: "problemDiscussion",  label: "Define the Problem"   },
    { key: "deepenDiscussion",   label: "Explore the Problem"  },
    { key: "ideationDiscussion", label: "Brainstorm Solutions" },
    { key: "refineDiscussion",   label: "Refine Your Invention"},
  ];

  sections.forEach(({ key, label }) => {
    if (!data[key]) return;
    children.push(sectionHeading(label), spacer(), ...renderDiscussion(data[key]), spacer());
  });

  // Invention Brief
  if (data.inventionBrief) {
    children.push(
      new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }),
      sectionHeading("Invention Brief"),
      spacer(),
      ...data.inventionBrief.split("\n").map((line) =>
        new Paragraph({
          spacing: { after: line.trim() === "" ? 120 : 60 },
          children: [new TextRun({
            text: line,
            font: "Arial",
            size: 20,
            color: line.startsWith(" ") || line.trim() === "" ? GRAY : BLACK,
            bold: /^[A-Z][A-Z\s]{3,}$/.test(line.trim()),
          })],
        })
      ),
    );
  }

  // ── Build & download ───────────────────────────────────────────────────────

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
              new TextRun({ text: "HAIIC Brainstorm", font: "Arial", size: 18, color: RED, bold: true }),
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
  const slug = (name || "invention").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  a.download = `HAIIC-Brainstorm-${slug}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Toolbar (Save Draft + Export buttons shown during session) ───────────────

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
      <div style={tb.projectName}>{project.name}</div>
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
  const [newName, setNewName] = useState("");

  useEffect(() => { setProjects(loadProjects()); }, []);

  const handleNew = () => {
    const name = newName.trim() || `Invention — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const project = {
      id: genId(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phase: 0,
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

  const phaseLabel = (i) => i >= PHASES.length - 1 ? "Complete ★" : `${PHASES[i]?.label || "?"}`;

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Brainstorm Projects</h2>
      <p style={ps.desc}>
        Each project saves your full session — resume any time, across devices, at any stage.
      </p>

      {/* New project row */}
      <div style={db.newRow}>
        <input
          style={{ ...ps.input, flex: 1, marginTop: 0 }}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleNew()}
          placeholder="Name your invention idea (optional)..."
        />
        <button onClick={handleNew} style={ps.startBtn}>
          Start New Project →
        </button>
      </div>

      {/* Saved projects */}
      {projects.length > 0 && (
        <div style={db.list}>
          <p style={db.listHeader}>SAVED PROJECTS ({projects.length})</p>
          {projects.map(p => (
            <div key={p.id} style={db.card}>
              <div style={db.cardLeft}>
                <div style={db.cardName}>{p.name}</div>
                <div style={db.cardMeta}>
                  Last saved {new Date(p.updatedAt).toLocaleString()} &nbsp;·&nbsp;
                  Stage: <span style={{ color: theme.red }}>{phaseLabel(p.phase)}</span>
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
        <div style={db.empty}>
          No saved projects yet. Start your first invention above.
        </div>
      )}
    </div>
  );
}

// ─── Phase Components ─────────────────────────────────────────────────────────

function WelcomePhase({ onNext }) {
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Welcome to Brainstorm</h2>
      <p style={ps.desc}>
        You have expertise that's more valuable than you think. Brainstorm is an AI-powered coach
        that helps you discover patentable innovations hiding in your professional knowledge.
      </p>
      <p style={ps.desc}>
        We'll walk through a guided conversation in five steps: understanding your expertise,
        identifying problems worth solving, exploring root causes, brainstorming solutions, and
        refining the strongest idea into an Invention Brief you can take straight into Patent Forge.
      </p>
      <p style={ps.desc}>
        No technical background required. No legal knowledge needed. Just your experience and
        willingness to think creatively.
      </p>
      <p style={ps.desc} style={{ fontSize: 13, color: theme.textDim }}>
        💾 Your progress saves automatically at every step. Resume any time.
      </p>
      <button onClick={onNext} style={ps.startBtn}>Let's Get Started →</button>
    </div>
  );
}

function DomainPhase({ data, setData, onNext }) {
  const [field,   setField]   = useState(data.field   || "");
  const [role,    setRole]    = useState(data.role    || "");
  const [insight, setInsight] = useState(data.insight || "");

  const canProceed = field.trim() && role.trim() && insight.trim();

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Tell Us About Your Expertise</h2>
      <p style={ps.desc}>We'll use this to understand your world before we start exploring ideas.</p>

      <label style={ps.label}>What field or industry do you work in?</label>
      <input style={ps.input} value={field} onChange={e => setField(e.target.value)}
        placeholder="e.g., Manufacturing, Healthcare, Education, Construction..." />

      <label style={ps.label}>What's your role or specialty?</label>
      <input style={ps.input} value={role} onChange={e => setRole(e.target.value)}
        placeholder="e.g., Machine operator, Nurse practitioner, High school teacher..." />

      <label style={ps.label}>What's something about your work that outsiders don't understand?</label>
      <textarea style={ps.textarea} value={insight} onChange={e => setInsight(e.target.value)}
        placeholder="The hidden knowledge, the workarounds, the things you know that aren't in any manual..."
        rows={4} />

      <button
        onClick={() => { setData({ ...data, field, role, insight }); onNext(); }}
        disabled={!canProceed}
        style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed" }}
      >
        Next: Define the Problem →
      </button>
    </div>
  );
}

function ProblemPhase({ data, setData, onNext }) {
  const systemPrompt = `You are an innovation coach at HAIIC (Human-AI Innovation Commons). You're helping someone discover patentable innovations in their expertise.

The user works in: ${data.field}
Their role: ${data.role}
Their insider insight: ${data.insight}

YOUR TASK: Help them identify a specific problem worth solving in their field.
- Start by acknowledging their expertise warmly
- Ask what frustrates them most in their daily work — what's broken, slow, wasteful, or dangerous?
- Listen for problems that suggest inventable solutions
- Help them articulate the problem clearly and specifically
- After 2-3 exchanges, help them state the problem in one clear sentence
- Keep responses to 2-3 paragraphs max
- Be encouraging — they know more than they think`;

  const chat = useChat(systemPrompt);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && chat.messages.length === 0) {
      initialized.current = true;
      chat.send("[SYSTEM: Greet the user warmly, reference their field and role, and ask about frustrations or problems they see in their work. Be specific to their domain.]");
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    setData({ ...data, problemDiscussion: allMsgs });
    onNext();
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Define the Problem</h2>
      <p style={ps.desc}>Let's identify what's broken, slow, or frustrating in your field. The best inventions start with real problems.</p>
      <ChatThread
        messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))}
        loading={chat.loading}
        onSend={msg => chat.send(msg)}
        placeholder="Describe what frustrates you most..."
      />
      {chat.messages.length > 3 && (
        <button onClick={proceed} style={ps.nextBtn}>Next: Explore Deeper →</button>
      )}
    </div>
  );
}

function DeepenPhase({ data, setData, onNext }) {
  const systemPrompt = `You are an innovation coach at HAIIC helping someone explore a problem deeply before brainstorming solutions.

User's field: ${data.field}
Role: ${data.role}
Problem discussion so far: ${(data.problemDiscussion || "").substring(0, 2000)}

YOUR TASK: Deepen understanding of the problem.
- Ask about root causes — why does this problem exist?
- Explore failed solutions — what has been tried before? Why didn't it work?
- Ask about ripple effects — who else does this problem affect?
- Look for hidden assumptions — what does everyone in the field take for granted?
- After 2-3 exchanges, summarize the key insight that could lead to a novel solution
- Keep responses to 2-3 paragraphs max`;

  const chat = useChat(systemPrompt);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && chat.messages.length === 0) {
      initialized.current = true;
      chat.send("[SYSTEM: Reference the problem they've identified and start probing deeper. Ask about root causes and failed solutions.]");
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    setData({ ...data, deepenDiscussion: allMsgs });
    onNext();
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Explore the Problem</h2>
      <p style={ps.desc}>Let's dig into why this problem exists and what's been tried before. The deeper we go, the more inventive the solution.</p>
      <ChatThread
        messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))}
        loading={chat.loading}
        onSend={msg => chat.send(msg)}
        placeholder="Share what you know about why this problem persists..."
      />
      {chat.messages.length > 3 && (
        <button onClick={proceed} style={ps.nextBtn}>Next: Brainstorm Solutions →</button>
      )}
    </div>
  );
}

function IdeatePhase({ data, setData, onNext }) {
  const systemPrompt = `You are an innovation coach at HAIIC helping someone brainstorm solutions to a problem they've deeply explored.

User's field: ${data.field}
Role: ${data.role}
Problem discussion: ${(data.problemDiscussion || "").substring(0, 1500)}
Deep exploration: ${(data.deepenDiscussion || "").substring(0, 1500)}

YOUR TASK: Generate creative solution ideas.
- Start by proposing 3-4 diverse ideas at different levels of ambition:
  1. A practical, near-term improvement
  2. A more ambitious reimagining
  3. A cross-industry inspiration (what would [other field] do?)
  4. A moonshot — "what if you could redesign the whole system?"
- After generating ideas, help them identify the 2-3 strongest candidates
- Keep energy high and creative — this is the fun part!
- Responses: 2-4 paragraphs, use clear formatting for distinct ideas`;

  const chat = useChat(systemPrompt);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && chat.messages.length === 0) {
      initialized.current = true;
      chat.send("[SYSTEM: Time to brainstorm! Start by briefly summarizing the problem in one sentence, then propose 3-4 diverse solution ideas at different levels of ambition. Make them creative and specific to the user's field. Ask which ones resonate.]");
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    setData({ ...data, ideationDiscussion: allMsgs });
    onNext();
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Brainstorm Solutions</h2>
      <p style={ps.desc}>Now the creative part. Let's generate ideas — wild and practical. React to what excites you and we'll build from there.</p>
      <ChatThread
        messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))}
        loading={chat.loading}
        onSend={msg => chat.send(msg)}
        placeholder="React to the ideas — what excites you? What would you change?"
      />
      {chat.messages.length > 4 && (
        <button onClick={proceed} style={ps.nextBtn}>Narrow Down & Refine →</button>
      )}
    </div>
  );
}

function RefinePhase({ data, setData, onNext }) {
  const systemPrompt = `You are an innovation coach at HAIIC helping someone refine their best idea into something concrete and potentially patentable.

User's field: ${data.field}
Role: ${data.role}
Full brainstorming session: ${(data.ideationDiscussion || "").substring(0, 2000)}

YOUR TASK: Refine the strongest idea into a concrete invention.
- Help them pick their strongest idea and develop it in detail
- Ask about: How would it work technically? What components? What materials?
- Explore: Who would use it? How would they get it? What would it cost?
- Think about what makes it NOVEL — what's different from anything that exists?
- Push for specificity: dimensions, mechanisms, processes, configurations
- After 3-4 exchanges, help them articulate: "A [thing] that [does what] by [how] to solve [problem]"
- Keep encouraging them — they're so close to having an invention!`;

  const chat = useChat(systemPrompt);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && chat.messages.length === 0) {
      initialized.current = true;
      chat.send("[SYSTEM: Help the user select and refine their strongest idea. Reference the specific ideas from brainstorming. Push for technical specificity.]");
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    setData({ ...data, refineDiscussion: allMsgs });
    onNext();
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Refine Your Invention</h2>
      <p style={ps.desc}>Let's take the strongest idea and make it concrete. Specificity is what turns a good idea into a patentable invention.</p>
      <ChatThread
        messages={chat.messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("[SYSTEM:")))}
        loading={chat.loading}
        onSend={msg => chat.send(msg)}
        placeholder="Describe how it would work in more detail..."
      />
      {chat.messages.length > 4 && (
        <button onClick={proceed} style={ps.nextBtn}>Generate Invention Brief →</button>
      )}
    </div>
  );
}

function SummaryPhase({ data, setData }) {
  const [brief,   setBrief]   = useState(data.inventionBrief || "");
  const [loading, setLoading] = useState(!data.inventionBrief);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    if (!data.inventionBrief) generateBrief();
  }, []);

  const generateBrief = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are generating a structured Invention Brief for the HAIIC (Human-AI Innovation Commons) pipeline. Based on the entire brainstorming session below, produce a clear, professional document with these sections:

INVENTION BRIEF
===============
Title: [Clear, descriptive title]
Field: [Technical field]
Inventor Background: [Brief summary of inventor's expertise]

PROBLEM STATEMENT
[2-3 sentences describing the problem]

PROPOSED SOLUTION
[2-3 paragraphs describing the invention in detail — what it is, how it works, what makes it novel]

KEY COMPONENTS
[List of main technical components or steps]

NOVELTY FACTORS
[What makes this different from existing solutions]

TARGET USERS
[Who would use this and why]

RECOMMENDED NEXT STEP
This Invention Brief is ready to be taken into Patent Forge, HAIIC's AI-guided patent drafting tool, where it can be developed into a full provisional patent application.`,
          messages: [{
            role: "user",
            content: `Generate the Invention Brief from this brainstorming session:\n\nField: ${data.field}\nRole: ${data.role}\nInsight: ${data.insight}\n\nProblem Discussion:\n${(data.problemDiscussion || "").substring(0, 1500)}\n\nDeep Exploration:\n${(data.deepenDiscussion || "").substring(0, 1500)}\n\nBrainstorming:\n${(data.ideationDiscussion || "").substring(0, 1500)}\n\nRefinement:\n${(data.refineDiscussion || "").substring(0, 1500)}`,
          }],
          max_tokens: 2000,
        }),
      });
      const result = await response.json();
      const text = result.content?.map(item => item.type === "text" ? item.text : "").join("\n");
      const finalBrief = text || "Unable to generate brief. Please try again.";
      setBrief(finalBrief);
      setData(prev => ({ ...prev, inventionBrief: finalBrief }));
    } catch {
      setBrief("Unable to generate brief. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Invention Brief</h2>
      <p style={ps.desc}>Here's your complete Invention Brief, ready to take into Patent Forge.</p>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
          <p>Generating your Invention Brief…</p>
        </div>
      ) : (
        <>
          <div style={ps.briefCard}>
            <pre style={ps.briefText}>{brief}</pre>
          </div>
          <div style={ps.briefActions}>
            <button onClick={handleCopy} style={ps.copyBtn}>
              {copied ? "✓ Copied!" : "Copy to Clipboard"}
            </button>
            <a href="/patent-forge" style={ps.forgeBtn}>Take to Patent Forge →</a>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BrainstormPage() {
  const [view,    setView]    = useState("dashboard"); // "dashboard" | "session"
  const [project, setProject] = useState(null);
  const [phase,   setPhase]   = useState(0);
  const [data,    setData]    = useState({});

  // ── Auto-save: persist project on every phase or data change ──────────────
  useEffect(() => {
    if (!project) return;
    const projects = loadProjects();
    const updated = updateProject(projects, project.id, { phase, data });
    saveProjects(updated);
  }, [phase, data]);

  // ── Wrapped setData that also triggers auto-save ──────────────────────────
  const handleSetData = (newData) => {
    setData(newData);
  };

  const goNext = () => setPhase(p => Math.min(p + 1, PHASES.length - 1));

  const goToPhase = (targetPhase) => {
    // Only allow jumping to completed phases (not ahead)
    if (targetPhase < phase) setPhase(targetPhase);
  };

  const handleNew = (proj) => {
    setProject(proj);
    setPhase(proj.phase || 0);
    setData(proj.data || {});
    setView("session");
  };

  const handleResume = (proj) => {
    setProject(proj);
    setPhase(proj.phase || 0);
    setData(proj.data || {});
    setView("session");
  };

  const handleDashboard = () => {
    // Save before leaving
    if (project) {
      const projects = loadProjects();
      const updated = updateProject(projects, project.id, { phase, data });
      saveProjects(updated);
    }
    setView("dashboard");
    setProject(null);
    setPhase(0);
    setData({});
  };

  const handleSave = () => {
    if (!project) return;
    const projects = loadProjects();
    const updated = updateProject(projects, project.id, { phase, data });
    saveProjects(updated);
  };

  const handleExport = () => {
    if (!project) return;
    exportToDocx({ ...project, phase, data });
  };

  // ── Dashboard view ────────────────────────────────────────────────────────
  if (view === "dashboard") {
    return (
      <Layout title="Brainstorm" logoSrc="/brainstorm-logo.png">
        <div style={styles.header}>
          <p style={styles.label}>BRAINSTORM</p>
          <h1 style={styles.heading}>Discover Your Next Invention</h1>
        </div>
        <ProjectDashboard onNew={handleNew} onResume={handleResume} />
      </Layout>
    );
  }

  // ── Session view ──────────────────────────────────────────────────────────
  return (
    <Layout title="Brainstorm" logoSrc="/brainstorm-logo.png">
      <div style={styles.header}>
        <p style={styles.label}>BRAINSTORM</p>
        <h1 style={styles.heading}>Discover Your Next Invention</h1>
      </div>

      {/* Session toolbar */}
      <SessionToolbar
        project={project}
        onSave={handleSave}
        onExport={handleExport}
        onDashboard={handleDashboard}
      />

      {/* Phase breadcrumbs */}
      <div style={styles.phases}>
        {PHASES.map((p, i) => {
          const isActive    = i === phase;
          const isCompleted = i < phase;
          const isFuture    = i > phase;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                onClick={() => isCompleted && goToPhase(i)}
                title={isCompleted ? `Return to ${p.label}` : undefined}
                style={{
                  ...styles.phaseChip,
                  background:   isActive    ? theme.red
                              : isCompleted ? theme.surfaceAlt
                              : "transparent",
                  borderColor:  isActive || isCompleted ? theme.red : theme.border,
                  color:        isActive    ? "#fff"
                              : isCompleted ? theme.textMuted
                              : theme.textDim,
                  cursor:       isCompleted ? "pointer" : "default",
                  textDecoration: isCompleted ? "none" : "none",
                  position: "relative",
                }}
              >
                {isCompleted && <span style={{ marginRight: 3, fontSize: 9 }}>✓</span>}
                {p.icon} {p.label}
              </div>
              {i < PHASES.length - 1 && (
                <span style={{ color: theme.textDim, fontSize: 10 }}>›</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase content */}
      {phase === 0 && <WelcomePhase onNext={goNext} />}
      {phase === 1 && <DomainPhase  data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 2 && <ProblemPhase data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 3 && <DeepenPhase  data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 4 && <IdeatePhase  data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 5 && <RefinePhase  data={data} setData={handleSetData} onNext={goNext} />}
      {phase === 6 && <SummaryPhase data={data} setData={handleSetData} />}
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
  phases: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 32,
    paddingBottom: 20,
    borderBottom: `1px solid ${theme.border}`,
  },
  phaseChip: {
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
  startBtn: {
    background: theme.red,
    border: "none",
    borderRadius: 8,
    color: "#fff",
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    whiteSpace: "nowrap",
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
    marginTop: 12,
  },
  briefCard: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  briefText: {
    fontSize: 13,
    lineHeight: 1.7,
    color: "#ccc",
    fontFamily: "'DM Sans', monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  briefActions: { display: "flex", gap: 12, flexWrap: "wrap" },
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
  forgeBtn: {
    padding: "12px 20px",
    background: theme.red,
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  },
};

const db = {
  newRow: {
    display: "flex",
    gap: 12,
    marginBottom: 32,
    alignItems: "center",
    flexWrap: "wrap",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  listHeader: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    color: theme.textDim,
    textTransform: "uppercase",
    marginBottom: 4,
  },
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
  cardLeft: { flex: 1, minWidth: 200 },
  cardName: { fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: theme.textDim },
  cardRight: { display: "flex", gap: 8, alignItems: "center" },
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
