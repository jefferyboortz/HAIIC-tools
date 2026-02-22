import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import ChatThread from "../components/ChatThread";
import useChat from "../components/useChat";
import theme from "../components/theme";

const SECTIONS = [
  { id: "inventor", label: "Inventor Info", icon: "①" },
  { id: "agreement", label: "Benefit-Sharing Agreement", icon: "②" },
  { id: "title", label: "Title & Field", icon: "③" },
  { id: "description", label: "Description", icon: "④" },
  { id: "claims", label: "Claims", icon: "⑤" },
  { id: "review", label: "Filing Package", icon: "★" },
];

// --- Section Components ---

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
      <input style={ps.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Jane M. Smith" />

      <label style={ps.label}>City</label>
      <input style={ps.input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Decatur" />

      <label style={ps.label}>State / Province</label>
      <input style={ps.input} value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g., Georgia" />

      <label style={ps.label}>Country</label>
      <input style={ps.input} value={country} onChange={(e) => setCountry(e.target.value)} />

      <label style={ps.label}>Email (optional)</label>
      <input style={ps.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="For filing correspondence" />

      <button
        onClick={() => { setData({ ...data, inventorName: name, city, state, country, email }); onNext(); }}
        disabled={!canProceed}
        style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4 }}
      >
        Next: Benefit-Sharing Agreement →
      </button>
    </div>
  );
}

function AgreementSection({ data, onNext }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>HAIC Benefit-Sharing Agreement</h2>
      <p style={ps.desc}>
        Every patent created through HAIC's tools enters our irrevocable three-way benefit-sharing
        framework. Please review and acknowledge the terms below.
      </p>

      <div style={ps.agreementCard}>
        <h3 style={ps.agreementTitle}>Benefit-Sharing Framework</h3>
        <p style={ps.agreementText}>
          Upon issuance of any non-provisional patent derived from this application,
          commercialization rights shall be administered under the HAIC Benefit-Sharing Framework:
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
          This framework is embedded in HAIC's founding documents with structural protections
          that prevent any future board from modifying or dissolving it.
        </p>
        <p style={ps.agreementNote}>
          Note: This acknowledgment documents your intent to participate in the HAIC Benefit-Sharing
          Framework. Formal assignment will be executed upon patent issuance with the assistance of
          legal counsel.
        </p>
      </div>

      <label style={ps.checkboxLabel}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={ps.checkbox}
        />
        I, {data.inventorName || "[inventor name]"}, acknowledge the HAIC Benefit-Sharing Framework
        and agree that upon issuance of any non-provisional patent derived from this application,
        commercialization rights shall be administered under this framework.
      </label>

      <button
        onClick={onNext}
        disabled={!agreed}
        style={{ ...ps.nextBtn, opacity: agreed ? 1 : 0.4 }}
      >
        I Agree — Next: Title & Field →
      </button>
    </div>
  );
}

function TitleSection({ data, setData, onNext }) {
  const [title, setTitle] = useState(data.patentTitle || "");
  const [field, setField] = useState(data.patentField || "");
  const [summary, setSummary] = useState(data.summary || "");

  const canProceed = title.trim() && field.trim() && summary.trim();

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Title & Field of Invention</h2>
      <p style={ps.desc}>Name your invention and describe it at a high level. Don't worry about perfection — the AI will help you refine.</p>

      <label style={ps.label}>Invention Title</label>
      <input style={ps.input} value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g., Self-Adjusting Ergonomic Assembly Fixture" />
      <p style={ps.hint}>Descriptive but concise. Think "what it is" not "what it's called."</p>

      <label style={ps.label}>Technical Field</label>
      <input style={ps.input} value={field} onChange={(e) => setField(e.target.value)}
        placeholder="e.g., Manufacturing Equipment, Medical Devices, Educational Technology..." />

      <label style={ps.label}>Brief Summary (2-3 sentences)</label>
      <textarea style={ps.textarea} value={summary} onChange={(e) => setSummary(e.target.value)}
        placeholder="What does your invention do? What problem does it solve? What makes it different from what exists?"
        rows={4} />

      <button
        onClick={() => { setData({ ...data, patentTitle: title, patentField: field, summary }); onNext(); }}
        disabled={!canProceed}
        style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4 }}
      >
        Next: Detailed Description →
      </button>
    </div>
  );
}

function DescriptionSection({ data, setData, onNext }) {
  const systemPrompt = `You are a patent drafting assistant at HAIC (Human-AI Innovation Commons), helping an inventor write the Detailed Description section of a provisional patent application.

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

  useEffect(() => {
    if (chat.messages.length === 0) {
      chat.send(`[SYSTEM: Start by acknowledging the invention "${data.patentTitle}" and ask the inventor to walk you through how it works, starting with the main components or steps.]`);
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
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
        onSend={(msg) => chat.send(msg)}
        placeholder="Describe how your invention works..."
      />
      {chat.messages.length > 5 && (
        <button onClick={proceed} style={ps.nextBtn}>Next: Draft Claims →</button>
      )}
    </div>
  );
}

function ClaimsSection({ data, setData, onNext }) {
  const systemPrompt = `You are a patent claims drafting assistant at HAIC. You're helping an inventor draft patent claims for their provisional application.

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

  useEffect(() => {
    if (chat.messages.length === 0) {
      chat.send(`[SYSTEM: Explain what patent claims are in simple terms, then draft a broad independent claim for "${data.patentTitle}" based on the description. Present it in both patent language and plain English.]`);
    }
  }, []);

  const proceed = () => {
    const allMsgs = chat.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
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
        onSend={(msg) => chat.send(msg)}
        placeholder="Review the claims and let me know what to adjust..."
      />
      {chat.messages.length > 4 && (
        <button onClick={proceed} style={ps.nextBtn}>Generate Filing Package →</button>
      )}
    </div>
  );
}

function ReviewSection({ data }) {
  const [document, setDocument] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateDocument();
  }, []);

  const generateDocument = async () => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are generating a complete provisional patent application document for the USPTO. Format it as a professional filing document with proper sections. Include:

1. HEADER with: "PROVISIONAL PATENT APPLICATION" title, inventor name, city, state, country, date
2. HAIC BENEFIT-SHARING ACKNOWLEDGMENT: "The undersigned inventor(s) agree that upon issuance of any non-provisional patent derived from this application, commercialization rights shall be administered under the HAIC Benefit-Sharing Framework, with revenue distributed equally among (1) the inventor(s), (2) programs supporting workers displaced by AI automation, and (3) AI safety and alignment research."
3. TITLE OF THE INVENTION
4. FIELD OF THE INVENTION
5. BACKGROUND OF THE INVENTION (synthesize from discussions)
6. SUMMARY OF THE INVENTION
7. DETAILED DESCRIPTION OF THE PREFERRED EMBODIMENT (comprehensive, from description discussion)
8. CLAIMS (properly formatted patent claims from claims discussion)
9. ABSTRACT (150-word summary)

Write in formal patent language. Be thorough and specific. This should read like a real provisional patent application.`,
          messages: [
            {
              role: "user",
              content: `Generate the complete provisional patent application:\n\nInventor: ${data.inventorName}\nCity: ${data.city}, ${data.state}, ${data.country}\nTitle: ${data.patentTitle}\nField: ${data.patentField}\nSummary: ${data.summary}\n\nDescription Discussion:\n${(data.descriptionDiscussion || "").substring(0, 3000)}\n\nClaims Discussion:\n${(data.claimsDiscussion || "").substring(0, 3000)}`,
            },
          ],
          max_tokens: 4000,
        }),
      });
      const result = await response.json();
      const text = result.content?.map((item) => (item.type === "text" ? item.text : "")).join("\n");
      setDocument(text || "Unable to generate document. Please try again.");
    } catch {
      setDocument("Unable to generate document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyDoc = () => {
    navigator.clipboard.writeText(document);
  };

  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Your Filing Package</h2>
      <p style={ps.desc}>
        Here's your complete provisional patent application. Review it carefully, then copy it
        for filing with the USPTO.
      </p>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
          <p>Generating your provisional patent application...</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>This may take a moment — we're compiling everything into a complete filing document.</p>
        </div>
      ) : (
        <>
          <div style={ps.docCard}>
            <pre style={ps.docText}>{document}</pre>
          </div>
          <div style={ps.docActions}>
            <button onClick={copyDoc} style={ps.copyBtn}>Copy to Clipboard</button>
          </div>
          <div style={ps.nextSteps}>
            <h3 style={ps.nextStepsTitle}>Next Steps</h3>
            <p style={ps.nextStepsText}>
              1. Review the document carefully for accuracy.
            </p>
            <p style={ps.nextStepsText}>
              2. File at the USPTO via EFS-Web (www.uspto.gov). Filing fee for a micro entity is approximately $80.
            </p>
            <p style={ps.nextStepsText}>
              3. Your provisional patent gives you 12 months of "patent pending" status while you pursue a non-provisional filing.
            </p>
            <p style={ps.nextStepsText}>
              4. HAIC will assist with commercialization and licensing under the benefit-sharing framework.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// --- Main Patent Forge Page ---

export default function PatentForgePage() {
  const [section, setSection] = useState(0);
  const [data, setData] = useState({});

  const goNext = () => setSection((s) => Math.min(s + 1, SECTIONS.length - 1));

  return (
    <Layout title="Patent Forge" logoSrc="/patentforge-logo.png">
      <div style={styles.header}>
        <p style={styles.label}>PATENT FORGE</p>
        <h1 style={styles.heading}>Draft Your Provisional Patent</h1>
      </div>

      {/* Section indicator */}
      <div style={styles.sections}>
        {SECTIONS.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                ...styles.sectionChip,
                background: i === section ? theme.red : i < section ? theme.surfaceAlt : "transparent",
                borderColor: i <= section ? theme.red : theme.border,
                color: i === section ? "#fff" : i < section ? theme.textMuted : theme.textDim,
              }}
            >
              {s.icon} {s.label}
            </div>
            {i < SECTIONS.length - 1 && <span style={{ color: theme.textDim, fontSize: 10 }}>›</span>}
          </div>
        ))}
      </div>

      {/* Section content */}
      {section === 0 && <InventorSection data={data} setData={setData} onNext={goNext} />}
      {section === 1 && <AgreementSection data={data} onNext={goNext} />}
      {section === 2 && <TitleSection data={data} setData={setData} onNext={goNext} />}
      {section === 3 && <DescriptionSection data={data} setData={setData} onNext={goNext} />}
      {section === 4 && <ClaimsSection data={data} setData={setData} onNext={goNext} />}
      {section === 5 && <ReviewSection data={data} />}
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
  hint: { fontSize: 12, color: theme.textDim, marginTop: 4 },
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
  splits: { display: "flex", gap: 20, margin: "20px 0" },
  split: { flex: 1, textAlign: "center" },
  splitPct: { fontSize: 28, fontWeight: 700, color: theme.red, marginBottom: 6 },
  splitLabel: { fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 },
  splitDesc: { fontSize: 12, color: theme.textMuted, lineHeight: 1.5 },
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
