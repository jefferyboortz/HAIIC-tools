import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import ChatThread from "../components/ChatThread";
import useChat from "../components/useChat";
import theme from "../components/theme";

const PHASES = [
  { id: "welcome", label: "Welcome", icon: "💡" },
  { id: "domain", label: "Your Expertise", icon: "①" },
  { id: "problem", label: "Define Problem", icon: "②" },
  { id: "deepen", label: "Explore", icon: "③" },
  { id: "ideate", label: "Brainstorm", icon: "④" },
  { id: "refine", label: "Refine", icon: "⑤" },
  { id: "summary", label: "Invention Brief", icon: "★" },
];

// --- Phase Components ---

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
      <button onClick={onNext} style={ps.startBtn}>Let's Get Started →</button>
    </div>
  );
}

function DomainPhase({ data, setData, onNext }) {
  const [field, setField] = useState(data.field || "");
  const [role, setRole] = useState(data.role || "");
  const [insight, setInsight] = useState(data.insight || "");

  const canProceed = field.trim() && role.trim() && insight.trim();

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Tell Us About Your Expertise</h2>
      <p style={ps.desc}>We'll use this to understand your world before we start exploring ideas.</p>

      <label style={ps.label}>What field or industry do you work in?</label>
      <input style={ps.input} value={field} onChange={(e) => setField(e.target.value)}
        placeholder="e.g., Manufacturing, Healthcare, Education, Construction..." />

      <label style={ps.label}>What's your role or specialty?</label>
      <input style={ps.input} value={role} onChange={(e) => setRole(e.target.value)}
        placeholder="e.g., Machine operator, Nurse practitioner, High school teacher..." />

      <label style={ps.label}>What's something about your work that outsiders don't understand?</label>
      <textarea style={ps.textarea} value={insight} onChange={(e) => setInsight(e.target.value)}
        placeholder="The hidden knowledge, the workarounds, the things you know that aren't in any manual..."
        rows={4} />

      <button
        onClick={() => { setData({ ...data, field, role, insight }); onNext(); }}
        disabled={!canProceed}
        style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4 }}
      >
        Next: Define the Problem →
      </button>
    </div>
  );
}

function ProblemPhase({ data, setData, onNext }) {
  const systemPrompt = `You are an innovation coach at HAIC (Human-AI Innovation Commons). You're helping someone discover patentable innovations in their expertise.

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

  useEffect(() => {
    if (chat.messages.length === 0) {
      chat.send("[SYSTEM: Greet the user warmly, reference their field and role, and ask about frustrations or problems they see in their work. Be specific to their domain.]");
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
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
        onSend={(msg) => chat.send(msg)}
        placeholder="Describe what frustrates you most..."
      />
      {chat.messages.length > 3 && (
        <button onClick={proceed} style={ps.nextBtn}>Next: Explore Deeper →</button>
      )}
    </div>
  );
}

function DeepenPhase({ data, setData, onNext }) {
  const systemPrompt = `You are an innovation coach at HAIC helping someone explore a problem deeply before brainstorming solutions.

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

  useEffect(() => {
    if (chat.messages.length === 0) {
      chat.send("[SYSTEM: Reference the problem they've identified and start probing deeper. Ask about root causes and failed solutions.]");
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
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
        onSend={(msg) => chat.send(msg)}
        placeholder="Share what you know about why this problem persists..."
      />
      {chat.messages.length > 3 && (
        <button onClick={proceed} style={ps.nextBtn}>Next: Brainstorm Solutions →</button>
      )}
    </div>
  );
}

function IdeatePhase({ data, setData, onNext }) {
  const systemPrompt = `You are an innovation coach at HAIC helping someone brainstorm solutions to a problem they've deeply explored.

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

  useEffect(() => {
    if (chat.messages.length === 0) {
      chat.send("[SYSTEM: Time to brainstorm! Start by briefly summarizing the problem in one sentence, then propose 3-4 diverse solution ideas at different levels of ambition. Make them creative and specific to the user's field. Ask which ones resonate.]");
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
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
        onSend={(msg) => chat.send(msg)}
        placeholder="React to the ideas — what excites you? What would you change?"
      />
      {chat.messages.length > 4 && (
        <button onClick={proceed} style={ps.nextBtn}>Narrow Down & Refine →</button>
      )}
    </div>
  );
}

function RefinePhase({ data, setData, onNext }) {
  const systemPrompt = `You are an innovation coach at HAIC helping someone refine their best idea into something concrete and potentially patentable.

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

  useEffect(() => {
    if (chat.messages.length === 0) {
      chat.send("[SYSTEM: Help the user select and refine their strongest idea. Reference the specific ideas from brainstorming. Push for technical specificity.]");
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
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
        onSend={(msg) => chat.send(msg)}
        placeholder="Describe how it would work in more detail..."
      />
      {chat.messages.length > 4 && (
        <button onClick={proceed} style={ps.nextBtn}>Generate Invention Brief →</button>
      )}
    </div>
  );
}

function SummaryPhase({ data }) {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateBrief();
  }, []);

  const generateBrief = async () => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are generating a structured Invention Brief for the HAIC (Human-AI Innovation Commons) pipeline. Based on the entire brainstorming session below, produce a clear, professional document with these sections:

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
This Invention Brief is ready to be taken into Patent Forge, HAIC's AI-guided patent drafting tool, where it can be developed into a full provisional patent application.`,
          messages: [
            {
              role: "user",
              content: `Generate the Invention Brief from this brainstorming session:\n\nField: ${data.field}\nRole: ${data.role}\nInsight: ${data.insight}\n\nProblem Discussion:\n${(data.problemDiscussion || "").substring(0, 1500)}\n\nDeep Exploration:\n${(data.deepenDiscussion || "").substring(0, 1500)}\n\nBrainstorming:\n${(data.ideationDiscussion || "").substring(0, 1500)}\n\nRefinement:\n${(data.refineDiscussion || "").substring(0, 1500)}`,
            },
          ],
          max_tokens: 2000,
        }),
      });
      const result = await response.json();
      const text = result.content?.map((item) => (item.type === "text" ? item.text : "")).join("\n");
      setBrief(text || "Unable to generate brief. Please try again.");
    } catch {
      setBrief("Unable to generate brief. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyBrief = () => {
    navigator.clipboard.writeText(brief);
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Invention Brief</h2>
      <p style={ps.desc}>Here's your complete Invention Brief, ready to take into Patent Forge.</p>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
          <p>Generating your Invention Brief...</p>
        </div>
      ) : (
        <>
          <div style={ps.briefCard}>
            <pre style={ps.briefText}>{brief}</pre>
          </div>
          <div style={ps.briefActions}>
            <button onClick={copyBrief} style={ps.copyBtn}>Copy to Clipboard</button>
            <a href="/patent-forge" style={ps.forgeBtn}>Take to Patent Forge →</a>
          </div>
        </>
      )}
    </div>
  );
}

// --- Main Brainstorm Page ---

export default function BrainstormPage() {
  const [phase, setPhase] = useState(0);
  const [data, setData] = useState({});

  const goNext = () => setPhase((p) => Math.min(p + 1, PHASES.length - 1));

  return (
    <Layout title="Brainstorm" logoSrc="/brainstorm-logo.png">
      <div style={styles.header}>
        <p style={styles.label}>BRAINSTORM</p>
        <h1 style={styles.heading}>Discover Your Next Invention</h1>
      </div>

      {/* Phase indicator */}
      <div style={styles.phases}>
        {PHASES.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                ...styles.phaseChip,
                background: i === phase ? theme.red : i < phase ? theme.surfaceAlt : "transparent",
                borderColor: i <= phase ? theme.red : theme.border,
                color: i === phase ? "#fff" : i < phase ? theme.textMuted : theme.textDim,
              }}
            >
              {p.icon} {p.label}
            </div>
            {i < PHASES.length - 1 && <span style={{ color: theme.textDim, fontSize: 10 }}>›</span>}
          </div>
        ))}
      </div>

      {/* Phase content */}
      {phase === 0 && <WelcomePhase onNext={goNext} />}
      {phase === 1 && <DomainPhase data={data} setData={setData} onNext={goNext} />}
      {phase === 2 && <ProblemPhase data={data} setData={setData} onNext={goNext} />}
      {phase === 3 && <DeepenPhase data={data} setData={setData} onNext={goNext} />}
      {phase === 4 && <IdeatePhase data={data} setData={setData} onNext={goNext} />}
      {phase === 5 && <RefinePhase data={data} setData={setData} onNext={goNext} />}
      {phase === 6 && <SummaryPhase data={data} />}
    </Layout>
  );
}

// --- Styles ---

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
  },
};

const ps = {
  content: { marginTop: 8 },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 24,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 12,
  },
  desc: { fontSize: 15, lineHeight: 1.7, color: theme.textMuted, marginBottom: 16 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: theme.textMuted, marginBottom: 6, marginTop: 16 },
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
  },
  startBtn: {
    background: theme.red,
    border: "none",
    borderRadius: 8,
    color: "#fff",
    padding: "14px 32px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    marginTop: 8,
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
  briefActions: { display: "flex", gap: 12 },
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
    display: "flex",
    alignItems: "center",
  },
};
