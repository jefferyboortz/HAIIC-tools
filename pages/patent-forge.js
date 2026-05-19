import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import Layout from "../components/Layout";
import ChatThread from "../components/ChatThread";
import theme from "../components/theme";

const SECTIONS = [
  { id: "inventor",   label: "Inventor Info",  icon: "①" },
  { id: "agreement",  label: "Our Vision",     icon: "②" },
  { id: "title",      label: "Title & Field",  icon: "③" },
  { id: "drafting",   label: "Drafting",       icon: "④" },
];

const HANDOFF_KEY    = "haiic_pf_handoff";
const TABLE          = "patent_projects";
const BRAINSTORM_TBL = "brainstorm_projects";
const UPLOAD_BUCKET  = "inventor-uploads";

const PHASES = ["describe", "claim"];
const PHASE_LABELS = { describe: "Describe", claim: "Claim" };

const CAPTURE_TYPES = ["description_block", "claimable_concept", "claim"];
const CAPTURE_LABELS = {
  description_block: "Description Block",
  claimable_concept: "Claimable Concept",
  claim: "Claim",
};

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function briefDisplayName(brief) {
  if (!brief) return "Untitled brief";
  return (brief.label && brief.label.trim()) || `Brief v${brief.versionNumber}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE UPLOAD / COPY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function uploadImageToBucket(file, userId, projectId) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const imageId = genId();
  const storagePath = `${userId}/${projectId}/${imageId}.${ext}`;

  const { error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error("Storage upload error:", error);
    throw error;
  }

  const { data, error: signError } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (signError) {
    console.error("Sign URL error:", signError);
    throw signError;
  }

  return { storagePath, displayUrl: data.signedUrl };
}

async function freshSignedUrl(storagePath, expirySeconds = 60 * 60) {
  const { data, error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(storagePath, expirySeconds);
  if (error || !data?.signedUrl) {
    console.error("Failed to generate signed URL:", storagePath, error);
    return null;
  }
  return data.signedUrl;
}

// Copy an image from a source storagePath (typically a Brainstorm folder) to a
// new destination under {userId}/{projectId}/. Returns the new storagePath.
async function copyImageToProjectFolder(sourceStoragePath, userId, projectId) {
  try {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(UPLOAD_BUCKET)
      .download(sourceStoragePath);

    if (downloadError || !blob) {
      console.error("Image download failed:", sourceStoragePath, downloadError);
      return null;
    }

    const ext = (sourceStoragePath.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const imageId = genId();
    const newStoragePath = `${userId}/${projectId}/${imageId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(UPLOAD_BUCKET)
      .upload(newStoragePath, blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: blob.type || "image/png",
      });

    if (uploadError) {
      console.error("Image copy upload failed:", newStoragePath, uploadError);
      return null;
    }

    return newStoragePath;
  } catch (err) {
    console.error("Image copy error:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────────────────────
function buildDraftingSystemPrompt({ project, captures, currentPhase, fromBrainstorm, brainstormBrief }) {
  const data = project.data || {};
  const title = data.patentTitle || "(untitled)";
  const field = data.patentField || "(unspecified field)";
  const summary = data.summary || "";
  const inventor = data.inventorName || "the inventor";

  const descBlocks = captures.filter(c => c.type === "description_block");
  const claimables = captures.filter(c => c.type === "claimable_concept");
  const drafted = captures.filter(c => c.type === "claim");

  const phaseGuide = currentPhase === "describe"
    ? `YOU ARE IN THE DESCRIBE PHASE.
- Help ${inventor} walk through how the invention works in detail.
- Ask follow-up questions about components, mechanisms, materials, alternative embodiments.
- When you have enough material for a coherent description chunk (a component, a mechanism, an embodiment), CAPTURE IT SILENTLY using [CAPTURE_PROPOSED] with type "description_block". Then mention it conversationally in your reply: "I captured that as a description block: '...'" — explicit and brief.
- When you notice something potentially claimable, CAPTURE IT SILENTLY using [CLAIMABLE_NOTED]. Mention it explicitly: "I noted that as a claimable concept: '...'"
- Do NOT draft claims in this phase. Claim drafting happens in the next phase.
- Do NOT ask the user for approval before capturing — captures auto-save and the user reviews them in the sidebar at their own pace.
- The user can move to the claim phase using the button in the sidebar. You don't need to prompt them about it; let the work guide the timing.`
    : `YOU ARE IN THE CLAIM PHASE.
- The describe phase is complete. You have ${descBlocks.length} description blocks and ${claimables.length} claimable concepts to work from.
- Your job is to draft claims for ${inventor}. ${inventor} is not a patent attorney and does not know the difference between independent and dependent claims — handle the structure for them.
- Draft a complete set of claims: one broad independent claim that captures the core invention, then 2-4 dependent claims that narrow it usefully.
- CAPTURE EACH CLAIM SILENTLY using [CAPTURE_PROPOSED] with type "claim". Title format: "Claim 1", "Claim 2", etc. Content should include both formal patent language AND a plain-English version.
- Mention each capture conversationally: "I drafted Claim 1 — it covers the core mechanism in broad terms."
- After drafting, invite ${inventor} to react. Help them refine specific claims based on their feedback (they can edit any claim from the sidebar).
- Do NOT propose new description_block or claimable_concept captures in this phase.`;

  const imageGuide = `
HANDLING IMAGE ATTACHMENTS

The inventor may attach images (sketches, photos, diagrams). When you receive an image:

1. ALWAYS acknowledge what you see explicitly before doing anything else. Describe the image in plain language. This catches misinterpretations early.

2. INCORPORATE the image into your understanding. When you later propose a description_block, reference what you saw.

3. FLAG CLAIMABLE FEATURES visible only in the image. Sometimes the image reveals details the inventor didn't articulate. If you see something potentially claimable — an angle, a spacing, an arrangement — note it as a claimable concept even if the user didn't mention it.

4. ASK CLARIFYING QUESTIONS when the image is ambiguous. Don't guess at unlabeled parts. Don't assume scale. Don't infer materials. Ask.`;

  const captureGuide = `
CAPTURE MARKERS

[CAPTURE_PROPOSED]
{"type":"description_block","title":"...","content":"..."}
[/CAPTURE_PROPOSED]

For claims:
[CAPTURE_PROPOSED]
{"type":"claim","title":"Claim 1","content":"Formal claim language.\\n\\nPlain English: ..."}
[/CAPTURE_PROPOSED]

For claimable concepts (describe phase only):
[CLAIMABLE_NOTED]
{"title":"...","content":"What makes this potentially claimable: ..."}
[/CLAIMABLE_NOTED]

CRITICAL RULES
- In describe phase, ONLY emit description_block or claimable_concept markers. NEVER emit claim markers in describe phase.
- In claim phase, ONLY emit claim markers. NEVER emit description_block or claimable_concept markers in claim phase.
- One CAPTURE_PROPOSED marker per turn maximum. CLAIMABLE_NOTED can appear in the same turn as a CAPTURE_PROPOSED.
- ALWAYS continue the conversation in natural language alongside any markers — the markers are silent metadata; the user only sees your prose.
- ALWAYS mention each capture explicitly in your prose so the user knows what just happened.`;

  const contextBlock = `
INVENTION CONTEXT
- Title: ${title}
- Field: ${field}
- Summary: ${summary || "(not provided)"}
- Inventor: ${inventor}
${fromBrainstorm && brainstormBrief ? `
PRIOR BRAINSTORM BRIEF (for your context, do not quote directly):
${brainstormBrief.substring(0, 2000)}` : ""}

CURRENT CAPTURE STATE
- Description blocks: ${descBlocks.length}
  ${descBlocks.map(c => `  • ${c.title}`).join("\n") || "  (none yet)"}
- Claimable concepts: ${claimables.length}
  ${claimables.map(c => `  • ${c.title}`).join("\n") || "  (none yet)"}
- Drafted claims: ${drafted.length}`;

  return `You are a patent drafting collaborator at HAIIC, helping inventors who are NOT patent attorneys draft provisional patent applications. Tone: warm, plain-English, never condescending. Translate jargon. Push for detail that lets someone in the field reproduce the invention. ${inventor} should never need to know terms like "independent claim" vs "dependent claim" — handle the structure for them.

${contextBlock}

${phaseGuide}

${imageGuide}

${captureGuide}`;
}

function buildImportAcknowledgmentPrompt({ patentTitle, brainstormBrief, imageCount }) {
  return `You are a patent drafting collaborator at HAIIC. The inventor has just brought work over from a Brainstorm session, and that work includes ${imageCount} image${imageCount === 1 ? "" : "s"} they uploaded during Brainstorm. Your job is to write an opening message that:

1. Acknowledges the project name and that you have the Brainstorm work in front of you.
2. Describes what you see in EACH attached image explicitly, in plain language. Don't be vague — name what's drawn, sketched, or photographed. If parts are unlabeled, say so and ask.
3. Briefly explains how Drafting works: you'll talk through the invention in detail, capture description blocks and claimable concepts as you go, and move to claims when ready.
4. Asks one good opening question that builds on what they've already done.

Project title: ${patentTitle}

Invention Brief (for your context):
${brainstormBrief.substring(0, 1500)}

Keep your message warm and direct. Address the images one at a time — the inventor will know which one you mean.

Do NOT propose any captures in this opening message. Do NOT use [CAPTURE_PROPOSED] or [CLAIMABLE_NOTED] markers. This is purely an acknowledgment and orientation message.`;
}

function buildNoveltyPrompt(captures) {
  const descBlocks = captures.filter(c => c.type === "description_block");
  const claimables = captures.filter(c => c.type === "claimable_concept");
  const claims = captures.filter(c => c.type === "claim");

  return `You are a knowledgeable friend who has been through the patent process. Give an honest, plain-English read on novelty and patentability based on what the inventor has captured so far.

You MUST start your response with a single integer between 1 and 10 inside [SCORE] tags, like this: [SCORE]4[/SCORE]

Scoring guide:
- 1-2: Nothing claimable yet (almost no captures, or only restatements of common knowledge)
- 3-4: Early — something potentially novel but underspecified
- 5-6: Promising — clear novel elements, needs more detail to be defensible
- 7-8: Strong — distinctive mechanism, well-specified, plausibly defensible against prior art
- 9-10: Excellent — clearly novel, well-described, multiple claimable angles

After the score, provide:

🔍 THE HONEST READ
One paragraph.

✅ WHAT'S WORKING
2-3 specific strengths.

⚠️ WATCH OUT FOR
1-2 prior art concerns.

💡 HOW TO STRENGTHEN IT
2-3 actionable suggestions.

End with: "Remember: the first idea is rarely the best — every refinement gets you closer. This is a starting point, not a verdict. A registered patent attorney can run a full prior art search before you file."

CAPTURES TO ASSESS:

Description Blocks (${descBlocks.length}):
${descBlocks.map(c => `• ${c.title}: ${c.content}`).join("\n") || "(none)"}

Claimable Concepts (${claimables.length}):
${claimables.map(c => `• ${c.title}: ${c.content}`).join("\n") || "(none)"}

Drafted Claims (${claims.length}):
${claims.map(c => `• ${c.title}: ${c.content}`).join("\n") || "(none)"}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKER PARSING
// ─────────────────────────────────────────────────────────────────────────────
function parseMarkers(text) {
  const proposals = [];
  const claimables = [];

  const proposedRe = /\[CAPTURE_PROPOSED\]([\s\S]*?)\[\/CAPTURE_PROPOSED\]/g;
  let m;
  while ((m = proposedRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (parsed.type && parsed.title && parsed.content) proposals.push(parsed);
    } catch {}
  }

  const claimableRe = /\[CLAIMABLE_NOTED\]([\s\S]*?)\[\/CLAIMABLE_NOTED\]/g;
  while ((m = claimableRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (parsed.title && parsed.content) claimables.push(parsed);
    } catch {}
  }

  const cleanText = text.replace(proposedRe, "").replace(claimableRe, "").trim();

  return { proposals, claimables, cleanText };
}

function parseScore(text) {
  const m = text.match(/\[SCORE\](\d+)\[\/SCORE\]/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (isNaN(n) || n < 1 || n > 10) return null;
  return n;
}

function stripScore(text) {
  return text.replace(/\[SCORE\]\d+\[\/SCORE\]/, "").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
function PatentForgeSidebar({ captures, currentPhase, onEditCapture, onDeleteCapture, onPhaseTransition }) {
  const grouped = {
    description_block: captures.filter(c => c.type === "description_block"),
    claimable_concept: captures.filter(c => c.type === "claimable_concept"),
    claim: captures.filter(c => c.type === "claim"),
  };

  const canAdvance = currentPhase === "describe"
    && grouped.description_block.length >= 2
    && grouped.claimable_concept.length >= 1;

  return (
    <div style={sb.wrap}>
      <div style={sb.section}>
        <p style={sb.sectionLabel}>PHASE</p>
        <div style={sb.phaseList}>
          {PHASES.map(p => {
            const isCurrent = p === currentPhase;
            const isPast = PHASES.indexOf(p) < PHASES.indexOf(currentPhase);
            return (
              <div key={p} style={{
                ...sb.phaseItem,
                color: isCurrent ? theme.red : isPast ? theme.textMuted : theme.textDim,
                fontWeight: isCurrent ? 700 : 500,
                textDecoration: isPast ? "line-through" : "none",
              }}>
                {isPast ? "✓" : isCurrent ? "●" : "○"} {PHASE_LABELS[p]}
              </div>
            );
          })}
        </div>
        {canAdvance && (
          <button onClick={onPhaseTransition} style={sb.advanceBtn}>
            Move to Claim Phase →
          </button>
        )}
      </div>

      {CAPTURE_TYPES.map(type => {
        const items = grouped[type];
        if (items.length === 0 && type === "claim" && currentPhase === "describe") return null;
        return (
          <div key={type} style={sb.section}>
            <p style={sb.sectionLabel}>
              {CAPTURE_LABELS[type].toUpperCase()}S {items.length > 0 && <span style={sb.count}>({items.length})</span>}
            </p>
            {items.length === 0 ? (
              <p style={sb.emptyHint}>
                {type === "description_block" && "Describe how your invention works — I'll capture pieces as we go."}
                {type === "claimable_concept" && "I'll flag claimable concepts as I notice them."}
                {type === "claim" && "Claims will be drafted in the claim phase."}
              </p>
            ) : (
              <div style={sb.list}>
                {items.map(c => (
                  <div key={c.id} style={sb.card}>
                    <div style={sb.cardHeader}>
                      <div style={sb.cardTitle}>{c.title}</div>
                      <div style={sb.cardActions}>
                        <button onClick={() => onEditCapture(c)} style={sb.iconBtn} title="Edit">✏</button>
                        <button onClick={() => onDeleteCapture(c)} style={sb.iconBtn} title="Delete">✕</button>
                      </div>
                    </div>
                    <div style={sb.cardContent}>{c.content.substring(0, 140)}{c.content.length > 140 ? "…" : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOVELTY ADVISOR (live tracker)
// ─────────────────────────────────────────────────────────────────────────────
function NoveltyAdvisor({ captures, savedScore, savedAssessment, savedThread, onSave }) {
  const [open, setOpen]               = useState(false);
  const [score, setScore]             = useState(savedScore ?? 1);
  const [direction, setDirection]     = useState(null);
  const [assessment, setAssessment]   = useState(savedAssessment || "");
  const [thread, setThread]           = useState(savedThread || []);
  const [loading, setLoading]         = useState(false);
  const [followUp, setFollowUp]       = useState("");
  const debounceRef                   = useRef(null);
  const lastCapturesHashRef           = useRef("");

  useEffect(() => {
    const capturesHash = JSON.stringify(captures.map(c => ({ id: c.id, content: c.content })));
    if (capturesHash === lastCapturesHashRef.current) return;
    if (captures.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      lastCapturesHashRef.current = capturesHash;
      await runScore();
    }, 2000);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [captures]);

  const runScore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildNoveltyPrompt(captures),
          messages: [{ role: "user", content: "Score and assess." }],
          max_tokens: 900,
        }),
      });
      const r = await res.json();
      const text = r.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "";
      const newScore = parseScore(text) ?? score;
      const newAssessment = stripScore(text);
      const newThread = [{ role: "assistant", content: newAssessment }];

      if (newScore > score) setDirection("up");
      else if (newScore < score) setDirection("down");
      else setDirection(null);

      setScore(newScore);
      setAssessment(newAssessment);
      setThread(newThread);
      onSave({ noveltyScore: newScore, noveltyAssessment: newAssessment, noveltyThread: newThread });

      setTimeout(() => setDirection(null), 3000);
    } catch {} finally {
      setLoading(false);
    }
  };

  const ask = async () => {
    if (!followUp.trim() || loading) return;
    const um = { role: "user", content: followUp };
    const nt = [...thread, um];
    setThread(nt);
    setFollowUp("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildNoveltyPrompt(captures),
          messages: [{ role: "user", content: "Score and assess." }, ...nt],
          max_tokens: 600,
        }),
      });
      const r = await res.json();
      const text = r.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Unable to respond.";
      const updated = [...nt, { role: "assistant", content: text }];
      setThread(updated);
      onSave({ noveltyScore: score, noveltyAssessment: assessment, noveltyThread: updated });
    } catch {} finally {
      setLoading(false);
    }
  };

  const scoreColor = score >= 7 ? "#80ff99" : score >= 4 ? "#ffd166" : theme.red;

  return (
    <div style={na.wrap}>
      <button onClick={() => setOpen(o => !o)} style={na.toggle}>
        <span>🔬 Novelty Advisor</span>
        <span style={{ ...na.scoreInline, color: scoreColor }}>
          {score}/10
          {direction === "up" && <span style={{ color: "#80ff99", marginLeft: 4 }}>↑</span>}
          {direction === "down" && <span style={{ color: theme.red, marginLeft: 4 }}>↓</span>}
        </span>
        <span style={{ marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={na.panel}>
          <p style={na.intro}>
            An honest read on patentability that updates as you describe more. The score is directional — a single AI's read, not a guarantee.
          </p>

          {loading && <p style={na.loadingMsg}>Assessing…</p>}

          {!loading && captures.length === 0 && (
            <p style={na.loadingMsg}>Add some description and I'll start scoring.</p>
          )}

          {assessment && (
            <>
              <div style={na.result}>
                <pre style={na.resultText}>{thread[0]?.content || assessment}</pre>
              </div>

              {thread.length > 1 && (
                <div style={na.threadWrap}>
                  {thread.slice(1).map((m, i) => (
                    <div key={i} style={{ ...na.msg, background: m.role === "user" ? "transparent" : theme.surfaceAlt }}>
                      <span style={{ ...na.msgRole, color: m.role === "assistant" ? theme.red : theme.text }}>
                        {m.role === "assistant" ? "Advisor" : "You"}:{"  "}
                      </span>
                      <span style={na.msgText}>{m.content}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={na.followRow}>
                <input
                  style={na.followInput}
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && ask()}
                  placeholder="Ask a follow-up…"
                  disabled={loading}
                />
                <button onClick={ask} disabled={loading || !followUp.trim()} style={na.askBtn}>Ask →</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE EDIT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CaptureEditPanel({ capture, onSave, onCancel }) {
  const [title, setTitle]         = useState(capture.title);
  const [content, setContent]     = useState(capture.content);
  const [instructions, setInstr]  = useState("");
  const [loading, setLoading]     = useState(false);
  const [pendingRevision, setPR]  = useState(null);

  const buildRevisionPrompt = () => `You are revising a captured note for a patent draft. Apply the user's revision instructions.

ORIGINAL CAPTURE
Title: ${capture.title}
Content: ${capture.content}

USER'S EDITS SO FAR
Title: ${title}
Content: ${content}

USER'S REVISION INSTRUCTIONS
${instructions}

Respond with ONLY the revised capture in this exact format:
[REVISION]
{"title":"...","content":"..."}
[/REVISION]`;

  const handleSave = async () => {
    if (instructions.trim()) {
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: buildRevisionPrompt(),
            messages: [{ role: "user", content: "Apply the revision." }],
            max_tokens: 1500,
          }),
        });
        const r = await res.json();
        const text = r.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "";
        const m = text.match(/\[REVISION\]([\s\S]*?)\[\/REVISION\]/);
        if (m) {
          const parsed = JSON.parse(m[1].trim());
          setPR(parsed);
        } else {
          alert("Couldn't parse the revision. Saving your manual edits instead.");
          onSave({ ...capture, title, content, updatedAt: new Date().toISOString() });
        }
      } catch {
        alert("Revision failed. Saving your manual edits instead.");
        onSave({ ...capture, title, content, updatedAt: new Date().toISOString() });
      } finally {
        setLoading(false);
      }
    } else {
      onSave({ ...capture, title, content, updatedAt: new Date().toISOString() });
    }
  };

  const acceptRevision = () => {
    onSave({ ...capture, title: pendingRevision.title, content: pendingRevision.content, updatedAt: new Date().toISOString() });
  };

  const rejectRevision = () => setPR(null);

  return (
    <div style={ed.wrap}>
      <div style={ed.header}>
        <span style={ed.headerTitle}>Editing: {CAPTURE_LABELS[capture.type]}</span>
        <button onClick={onCancel} style={ed.closeBtn}>✕ Cancel</button>
      </div>

      {pendingRevision ? (
        <>
          <p style={ed.label}>REVISED TITLE</p>
          <div style={ed.preview}>{pendingRevision.title}</div>
          <p style={ed.label}>REVISED CONTENT</p>
          <div style={ed.preview}>{pendingRevision.content}</div>
          <div style={ed.row}>
            <button onClick={acceptRevision} style={ed.saveBtn}>✓ Accept Revision</button>
            <button onClick={rejectRevision} style={ed.cancelBtn}>← Back to Edit</button>
          </div>
        </>
      ) : (
        <>
          <label style={ed.label}>TITLE</label>
          <input style={ed.input} value={title} onChange={e => setTitle(e.target.value)} />
          <label style={ed.label}>CONTENT</label>
          <textarea style={ed.textarea} value={content} onChange={e => setContent(e.target.value)} rows={6} />
          <label style={ed.label}>REVISION INSTRUCTIONS (optional)</label>
          <textarea
            style={ed.textarea}
            value={instructions}
            onChange={e => setInstr(e.target.value)}
            placeholder="e.g., 'make it more specific about materials' — leave blank to save manual edits only"
            rows={2}
          />
          <div style={ed.row}>
            <button onClick={handleSave} disabled={loading} style={ed.saveBtn}>
              {loading ? "Revising…" : instructions.trim() ? "Apply Revision →" : "✓ Save Edits"}
            </button>
            <button onClick={onCancel} style={ed.cancelBtn}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPED DELETE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function TypedDeleteModal({ capture, onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");
  const ready = typed === "DELETE";

  return (
    <div style={dm.backdrop}>
      <div style={dm.modal}>
        <h3 style={dm.title}>Delete this capture?</h3>
        <p style={dm.body}>
          You're about to delete <strong>{capture.title}</strong>. This can't be undone.
        </p>
        <p style={dm.body}>Type <strong>DELETE</strong> below to confirm.</p>
        <input
          style={dm.input}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
        <div style={dm.row}>
          <button onClick={() => onConfirm()} disabled={!ready} style={{ ...dm.deleteBtn, opacity: ready ? 1 : 0.3, cursor: ready ? "pointer" : "not-allowed" }}>
            Delete Permanently
          </button>
          <button onClick={onCancel} style={dm.cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFTING SECTION
// ─────────────────────────────────────────────────────────────────────────────
function DraftingSection({ project, data, setData, handle, userId }) {
  const [messages, setMessages]           = useState(data.messages || []);
  const [captures, setCaptures]           = useState(data.captures || []);
  const [currentPhase, setCurrentPhase]   = useState(data.currentPhase || "describe");
  const [editingCapture, setEC]           = useState(null);
  const [deletingCapture, setDC]          = useState(null);
  const [loading, setLoading]             = useState(false);
  const [signedUrlCache, setSUC]          = useState({});
  const initialized                       = useRef(false);

  // Hydrate signed URLs for any messages that have attachments
  useEffect(() => {
    const hydrate = async () => {
      const toFetch = [];
      messages.forEach(m => {
        if (Array.isArray(m.attachments)) {
          m.attachments.forEach(att => {
            if (att.storagePath && !signedUrlCache[att.storagePath]) {
              toFetch.push(att.storagePath);
            }
          });
        }
      });
      if (toFetch.length === 0) return;
      const fresh = {};
      for (const sp of toFetch) {
        const url = await freshSignedUrl(sp);
        if (url) fresh[sp] = url;
      }
      if (Object.keys(fresh).length > 0) setSUC(c => ({ ...c, ...fresh }));
    };
    hydrate();
  }, [messages]);

  // Bootstrap opener on first entry
  useEffect(() => {
    if (initialized.current) return;
    if (messages.length > 0) { initialized.current = true; return; }
    initialized.current = true;

    const fromBrainstorm = !!data.fromBrainstorm;
    const importedImages = Array.isArray(data.importedImages) ? data.importedImages : [];

    if (fromBrainstorm && importedImages.length > 0) {
      // Image-aware import opener — make an API call that includes the images,
      // and let the AI acknowledge what it sees in each one.
      bootstrapImportAcknowledgmentOpener(importedImages);
      return;
    }

    const opener = fromBrainstorm
      ? `Let's draft your provisional patent for **${data.patentTitle || "this invention"}**. Here's how this works: we'll build on the Brainstorm work you already did — I have your Invention Brief in front of me — and develop it into something detailed enough to file. As we talk, I'll capture pieces of the description and flag concepts that look potentially claimable. You'll see those building up in the sidebar to the right. When you're ready, we'll move to drafting the claims.\n\nYou can attach sketches, photos, or diagrams anytime using the 📎 button — visual thinkers welcome.\n\nTo start: looking back at your Brainstorm work, are there any refinements or new ideas that have come to mind since you wrote the brief? Or anything you want to sharpen before we go further?`
      : `Let's draft your provisional patent for **${data.patentTitle || "this invention"}**. Here's how this works: we'll talk through your invention in your own words — I'll ask questions to make sure I understand it, and as we go I'll capture pieces of the description and flag concepts that look potentially claimable. You'll see those building up in the sidebar to the right. When you're ready, we'll move to drafting the claims.\n\nYou can attach sketches, photos, or diagrams anytime using the 📎 button — visual thinkers welcome.\n\nTo start: tell me about your invention. What does it do, and what problem does it solve?`;

    const openerMsg = {
      id: genId(),
      role: "assistant",
      content: opener,
      createdAt: new Date().toISOString(),
    };
    setMessages([openerMsg]);
  }, []);

  const bootstrapImportAcknowledgmentOpener = async (importedImages) => {
    setLoading(true);
    try {
      // Get short-lived URLs for each imported image for the API call
      const apiAttachments = [];
      for (const img of importedImages) {
        const url = await freshSignedUrl(img.storagePath, 5 * 60);
        if (url) apiAttachments.push({ type: "image", url });
      }

      const system = buildImportAcknowledgmentPrompt({
        patentTitle: data.patentTitle || "this invention",
        brainstormBrief: data.brainstormBrief || "",
        imageCount: importedImages.length,
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: [{
            role: "user",
            content: "Here are the images I uploaded during Brainstorm. Please acknowledge each one and orient me to Drafting.",
            attachments: apiAttachments,
          }],
          max_tokens: 2500,
        }),
      });
      const r = await res.json();
      const text = r.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "Welcome to Drafting. Let's start by walking through your invention.";

      // The opener message has all the imported images attached for display
      const openerMsg = {
        id: genId(),
        role: "assistant",
        content: text,
        createdAt: new Date().toISOString(),
        attachments: importedImages.map(img => ({
          type: "image",
          storagePath: img.storagePath,
          filename: img.filename || "imported image",
        })),
      };
      setMessages([openerMsg]);
    } catch (err) {
      console.error("Import acknowledgment bootstrap failed:", err);
      const fallbackMsg = {
        id: genId(),
        role: "assistant",
        content: `Welcome to Drafting. I have your Brainstorm work and ${importedImages.length} image${importedImages.length === 1 ? "" : "s"} you uploaded. Let's walk through your invention — tell me about it in your own words.`,
        createdAt: new Date().toISOString(),
        attachments: importedImages.map(img => ({
          type: "image",
          storagePath: img.storagePath,
          filename: img.filename || "imported image",
        })),
      };
      setMessages([fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Persist on every change
  useEffect(() => {
    setData({ ...data, messages, captures, currentPhase });
  }, [messages, captures, currentPhase]);

  useEffect(() => {
    const flush = () => {
      try {
        supabase.from(TABLE).update({ data: { ...data, messages, captures, currentPhase }, updated_at: new Date().toISOString() }).eq("id", project.id);
      } catch {}
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [messages, captures, currentPhase]);

  // Apply hydrated signed URLs to messages for display
  const messagesForDisplay = messages.map(m => {
    if (!Array.isArray(m.attachments)) return m;
    return {
      ...m,
      attachments: m.attachments.map(att => {
        if (att.type === "image" && att.storagePath) {
          return { ...att, displayUrl: signedUrlCache[att.storagePath] || att.displayUrl };
        }
        return att;
      }),
    };
  });

  const handleUploadImage = async (file) => {
    if (!userId || !project?.id) {
      throw new Error("Missing user or project context");
    }
    return await uploadImageToBucket(file, userId, project.id);
  };

  const sendMessage = async (text, attachment) => {
    if ((!text || !text.trim()) && !attachment) return;
    if (loading) return;

    const userMsg = {
      id: genId(),
      role: "user",
      content: text || "",
      createdAt: new Date().toISOString(),
    };
    if (attachment) {
      userMsg.attachments = [{
        type: "image",
        storagePath: attachment.storagePath,
        displayUrl: attachment.displayUrl,
        filename: attachment.filename,
      }];
    }
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const system = buildDraftingSystemPrompt({
        project,
        captures,
        currentPhase,
        fromBrainstorm: !!data.fromBrainstorm,
        brainstormBrief: data.brainstormBrief,
      });

      const apiMessages = await Promise.all(updated.map(async m => {
        const base = { role: m.role, content: m.content };
        if (Array.isArray(m.attachments) && m.attachments.length > 0) {
          const apiAttachments = [];
          for (const att of m.attachments) {
            if (att.type === "image" && att.storagePath) {
              const url = await freshSignedUrl(att.storagePath, 5 * 60);
              if (url) apiAttachments.push({ type: "image", url });
            }
          }
          if (apiAttachments.length > 0) base.attachments = apiAttachments;
        }
        return base;
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, messages: apiMessages, max_tokens: 2500 }),
      });
      const r = await res.json();
      const raw = r.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "I'm having trouble responding.";

      const { proposals, claimables, cleanText } = parseMarkers(raw);

      const validProposals = proposals.filter(p => {
        if (currentPhase === "describe") return p.type === "description_block";
        if (currentPhase === "claim") return p.type === "claim";
        return false;
      });

      const assistantMsg = {
        id: genId(),
        role: "assistant",
        content: cleanText || "(no response)",
        createdAt: new Date().toISOString(),
      };
      setMessages(m => [...m, assistantMsg]);

      const newCaptures = [];

      validProposals.forEach(p => {
        newCaptures.push({
          id: genId(),
          type: p.type,
          title: p.title,
          content: p.content,
          createdAt: new Date().toISOString(),
          sourceMsgIdx: updated.length,
          sourceImageStoragePath: attachment?.storagePath || null,
        });
      });

      if (currentPhase === "describe") {
        claimables.forEach(c => {
          newCaptures.push({
            id: genId(),
            type: "claimable_concept",
            title: c.title,
            content: c.content,
            createdAt: new Date().toISOString(),
            sourceMsgIdx: updated.length,
            sourceImageStoragePath: attachment?.storagePath || null,
          });
        });
      }

      if (newCaptures.length > 0) {
        setCaptures(prev => [...prev, ...newCaptures]);
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      const errorMsg = {
        id: genId(),
        role: "assistant",
        content: "I'm having trouble responding right now — please try again in a moment.",
        createdAt: new Date().toISOString(),
      };
      setMessages(m => [...m, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCapture = (cap) => setEC(cap);
  const handleSaveEdit = (updated) => {
    setCaptures(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEC(null);
  };
  const handleDeleteCapture = (cap) => setDC(cap);
  const handleConfirmDelete = () => {
    setCaptures(prev => prev.filter(c => c.id !== deletingCapture.id));
    setDC(null);
  };

  const handlePhaseTransition = async () => {
    if (currentPhase !== "describe") return;
    setCurrentPhase("claim");
    setLoading(true);
    try {
      const system = buildDraftingSystemPrompt({
        project,
        captures,
        currentPhase: "claim",
        fromBrainstorm: !!data.fromBrainstorm,
        brainstormBrief: data.brainstormBrief,
      });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: [{ role: "user", content: "We're moving to the claim phase. Acknowledge the transition briefly, then draft Claim 1 (the broad independent claim) using [CAPTURE_PROPOSED] with type 'claim'. Mention it conversationally. Tell the user you'll continue with dependent claims after they see this first one." }],
          max_tokens: 2500,
        }),
      });
      const r = await res.json();
      const raw = r.content?.map(i => i.type === "text" ? i.text : "").join("\n") || "";
      const { proposals, cleanText } = parseMarkers(raw);

      const dividerMsg = {
        id: genId(),
        role: "divider",
        content: "DESCRIBE PHASE COMPLETE. NOW DRAFTING CLAIMS.",
        createdAt: new Date().toISOString(),
      };
      const assistantMsg = {
        id: genId(),
        role: "assistant",
        content: cleanText || "Drafting claims now…",
        createdAt: new Date().toISOString(),
      };
      setMessages(m => [...m, dividerMsg, assistantMsg]);

      const validProposals = proposals.filter(p => p.type === "claim");
      if (validProposals.length > 0) {
        const newCaptures = validProposals.map(p => ({
          id: genId(),
          type: "claim",
          title: p.title,
          content: p.content,
          createdAt: new Date().toISOString(),
          sourceMsgIdx: messages.length + 1,
        }));
        setCaptures(prev => [...prev, ...newCaptures]);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const updateNovelty = (u) => {
    setData({ ...data, ...u });
  };

  const dividerActions = [];
  messagesForDisplay.forEach((m, i) => {
    if (m.role === "divider") {
      dividerActions.push({
        afterMessageIdx: i - 1,
        node: <div style={ca.divider}><span>{m.content}</span></div>,
      });
    }
  });

  const visibleMessages = messagesForDisplay.filter(m => m.role !== "divider");

  const adjustedActions = dividerActions.map(action => {
    let visibleIdx = -1;
    for (let i = 0; i <= action.afterMessageIdx; i++) {
      if (messagesForDisplay[i] && messagesForDisplay[i].role !== "divider") visibleIdx++;
    }
    return { ...action, afterMessageIdx: visibleIdx };
  });

  const hideChatInput = !!editingCapture;

  return (
    <div style={pg.twoCol}>
      <div style={pg.leftCol}>
        <ChatThread
          messages={visibleMessages}
          loading={loading}
          onSend={sendMessage}
          placeholder={currentPhase === "describe" ? "Describe how your invention works…" : "React to the draft claims or ask for revisions…"}
          inlineActions={adjustedActions}
          hideInput={hideChatInput}
          onUploadImage={handleUploadImage}
          uploadEnabled={true}
        />

        {editingCapture && (
          <CaptureEditPanel
            capture={editingCapture}
            onSave={handleSaveEdit}
            onCancel={() => setEC(null)}
          />
        )}

        <NoveltyAdvisor
          captures={captures}
          savedScore={data.noveltyScore}
          savedAssessment={data.noveltyAssessment}
          savedThread={data.noveltyThread}
          onSave={updateNovelty}
        />
      </div>

      <div style={pg.rightCol}>
        <PatentForgeSidebar
          captures={captures}
          currentPhase={currentPhase}
          onEditCapture={handleEditCapture}
          onDeleteCapture={handleDeleteCapture}
          onPhaseTransition={handlePhaseTransition}
        />
      </div>

      {deletingCapture && (
        <TypedDeleteModal
          capture={deletingCapture}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDC(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAINSTORM IMPORT PICKER
// ─────────────────────────────────────────────────────────────────────────────
function BrainstormImportPicker({ onImport }) {
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [brainstormProjects, setBP]   = useState([]);
  const [fetched, setFetched]         = useState(false);
  const [importing, setImporting]     = useState(false);

  const fetchBrainstormProjects = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from(BRAINSTORM_TBL).select("*").order("updated_at", { ascending: false });
      setBP(Array.isArray(data) ? data : []);
    } catch {
      setBP([]);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !fetched) fetchBrainstormProjects();
  };

  const handlePick = async (project) => {
    if (importing) return;
    const briefs = Array.isArray(project?.data?.briefs) ? project.data.briefs : [];
    if (briefs.length === 0) return;
    const latest = briefs[briefs.length - 1];
    const briefContent = latest?.content || "";
    const titleMatch = briefContent.match(/Title:\s*(.+)/);
    const fieldMatch = briefContent.match(/Field:\s*(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : "";
    const field = fieldMatch ? fieldMatch[1].trim() : "";
    const referencedImages = Array.isArray(latest.referencedImages) ? latest.referencedImages : [];

    setImporting(true);
    try {
      await onImport({
        name: project.name || "Brainstorm Import",
        patentTitle: title,
        patentField: field,
        brainstormBrief: briefContent,
        briefVersionLabel: briefDisplayName(latest),
        referencedImages,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={imp.wrap}>
      <button onClick={toggleOpen} style={imp.toggle}>
        {open ? "▼" : "▶"} Or import from a Brainstorm project
      </button>
      {open && (
        <div style={imp.panel}>
          <p style={imp.constraint}>
            Patent Forge imports the <strong>latest brief</strong> from each Brainstorm project, along with any images you uploaded during that session.
            To use an older version, open the project in Brainstorm first and re-synthesize from
            the captures you want — that version becomes the new latest.
          </p>
          {loading && <p style={imp.loadingMsg}>Loading your Brainstorm projects…</p>}
          {importing && <p style={imp.loadingMsg}>Importing brief and copying images — this can take a few seconds…</p>}
          {!loading && fetched && brainstormProjects.length === 0 && (
            <p style={imp.emptyMsg}>
              No Brainstorm projects yet. Start one in Brainstorm first, then come back here to import.
            </p>
          )}
          {!loading && brainstormProjects.length > 0 && (
            <div style={imp.list}>
              {brainstormProjects.map(p => {
                const briefs = Array.isArray(p?.data?.briefs) ? p.data.briefs : [];
                const hasBrief = briefs.length > 0;
                const latest = hasBrief ? briefs[briefs.length - 1] : null;
                const imgCount = Array.isArray(latest?.referencedImages) ? latest.referencedImages.length : 0;
                return (
                  <div key={p.id} style={{ ...imp.row, ...(hasBrief ? {} : imp.rowDim) }}>
                    <div style={imp.rowMain}>
                      <div style={imp.rowLeft}>
                        <div style={imp.rowName}>{p.name}</div>
                        <div style={imp.rowMeta}>
                          {hasBrief ? (
                            <>
                              Latest: <span style={imp.versionLabel}>{briefDisplayName(latest)}</span>
                              {" · "}{new Date(latest.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {imgCount > 0 && <span style={imp.imgTag}>{imgCount} image{imgCount === 1 ? "" : "s"}</span>}
                            </>
                          ) : (
                            <span style={imp.noBriefIndicator}>No brief yet</span>
                          )}
                        </div>
                      </div>
                      {hasBrief ? (
                        <button onClick={() => handlePick(p)} disabled={importing} style={{ ...imp.useBtn, opacity: importing ? 0.5 : 1, cursor: importing ? "not-allowed" : "pointer" }}>
                          Use this →
                        </button>
                      ) : (
                        <span style={imp.useBtnDisabled}>—</span>
                      )}
                    </div>
                    {!hasBrief && (
                      <p style={imp.rowInstruction}>
                        No brief synthesized yet for this project. Open it in Brainstorm and click
                        "Generate Invention Brief" (or "Synthesize new version" if you've already started).
                        Then come back here.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function ProjectDashboard({ onNew, onResume, onSignOut, handle, isFirstTimeUser, userId }) {
  const [projects, setProjects] = useState([]); const [newName, setNewName] = useState(""); const [loading, setLoading] = useState(true); const [handoff, setHandoff] = useState(null); const [processingHandoff, setProcessingHandoff] = useState(false);
  useEffect(() => { fetchProjects(); try { const h = localStorage.getItem(HANDOFF_KEY); if (h) setHandoff(JSON.parse(h)); } catch {} }, []);
  const fetchProjects = async () => { setLoading(true); const { data } = await supabase.from(TABLE).select("*").order("updated_at", { ascending: false }); setProjects(data || []); setLoading(false); };

  const handleHandoff = async () => {
    if (!handoff || processingHandoff) return;
    setProcessingHandoff(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newProjectId = genId();
      const referencedImages = Array.isArray(handoff.referencedImages) ? handoff.referencedImages : [];
      const importedImages = [];
      for (const ref of referencedImages) {
        if (!ref?.storagePath) continue;
        const newPath = await copyImageToProjectFolder(ref.storagePath, user.id, newProjectId);
        if (newPath) {
          importedImages.push({
            storagePath: newPath,
            filename: ref.filename || "imported image",
            caption: ref.caption || "",
          });
        }
      }

      const project = {
        id: newProjectId,
        user_id: user.id,
        name: handoff.name || "Brainstorm Import",
        section: 0,
        data: {
          patentTitle: handoff.patentTitle || "",
          patentField: handoff.patentField || handoff.field || "",
          summary: handoff.inventionBrief ? handoff.inventionBrief.substring(0, 400) : "",
          brainstormBrief: handoff.inventionBrief || "",
          fromBrainstorm: true,
          importedImages,
        },
      };
      await supabase.from(TABLE).insert(project);
      try { localStorage.removeItem(HANDOFF_KEY); } catch {}
      setHandoff(null);
      onNew(project);
    } finally {
      setProcessingHandoff(false);
    }
  };

  const handleNew = async () => { const name = newName.trim() || `Patent Application — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`; const { data: { user } } = await supabase.auth.getUser(); const project = { id: genId(), user_id: user.id, name, section: 0, data: {} }; await supabase.from(TABLE).insert(project); setNewName(""); onNew(project); };

  const handleImportFromBrainstorm = async (imported) => {
    const { data: { user } } = await supabase.auth.getUser();
    const newProjectId = genId();
    const referencedImages = Array.isArray(imported.referencedImages) ? imported.referencedImages : [];
    const importedImages = [];
    for (const ref of referencedImages) {
      if (!ref?.storagePath) continue;
      const newPath = await copyImageToProjectFolder(ref.storagePath, user.id, newProjectId);
      if (newPath) {
        importedImages.push({
          storagePath: newPath,
          filename: ref.filename || "imported image",
          caption: ref.caption || "",
        });
      }
    }
    const project = {
      id: newProjectId,
      user_id: user.id,
      name: imported.name,
      section: 0,
      data: {
        patentTitle: imported.patentTitle || "",
        patentField: imported.patentField || "",
        summary: imported.brainstormBrief ? imported.brainstormBrief.substring(0, 400) : "",
        brainstormBrief: imported.brainstormBrief || "",
        importedBriefVersion: imported.briefVersionLabel || "",
        fromBrainstorm: true,
        importedImages,
      },
    };
    await supabase.from(TABLE).insert(project);
    onNew(project);
  };

  const handleDelete = async (id, name) => { if (!confirm(`Delete "${name}"?`)) return; await supabase.from(TABLE).delete().eq("id", id); setProjects(p => p.filter(x => x.id !== id)); };
  const handleRename = async (id) => { const p = projects.find(p => p.id === id); const n = prompt("Rename:", p.name); if (!n?.trim()) return; await supabase.from(TABLE).update({ name: n.trim(), updated_at: new Date().toISOString() }).eq("id", id); setProjects(prev => prev.map(x => x.id === id ? { ...x, name: n.trim() } : x)); };
  const sl = (i) => SECTIONS[i]?.label || "?";

  return (
    <div style={ps.content}>
      <div style={db.topRow}><h2 style={ps.title}>Your Patent Applications</h2><div style={db.userRow}><span style={db.userHandle}>{handle}</span><button onClick={onSignOut} style={db.signOutBtn}>Sign Out</button></div></div>
      <p style={ps.desc}>Each application saves automatically — resume from any device, any time.</p>
      {isFirstTimeUser && !handoff && (
        <div style={wb.banner}>
          <div style={wb.icon}>👋</div>
          <div style={wb.body}>
            <div style={wb.title}>Welcome to Patent Forge, {handle}.</div>
            <div style={wb.text}>Ready to draft your first provisional patent application? Start a new project below — you'll walk through each section with AI guidance, save automatically, and end up with a USPTO-ready filing package.</div>
          </div>
        </div>
      )}
      {handoff && (
        <div style={hf.banner}>
          <div style={hf.bannerLeft}>
            <div style={hf.bannerTitle}>🔗 Brainstorm session ready to continue</div>
            <div style={hf.bannerMeta}>
              "{handoff.name}" — title, field, and brief pre-filled.
              {Array.isArray(handoff.referencedImages) && handoff.referencedImages.length > 0 && (
                <> Including {handoff.referencedImages.length} image{handoff.referencedImages.length === 1 ? "" : "s"} you uploaded.</>
              )}
            </div>
          </div>
          <div style={hf.bannerRight}>
            <button onClick={handleHandoff} disabled={processingHandoff} style={{ ...hf.continueBtn, opacity: processingHandoff ? 0.5 : 1, cursor: processingHandoff ? "not-allowed" : "pointer" }}>
              {processingHandoff ? "Importing…" : "Continue in Patent Forge →"}
            </button>
            <button onClick={() => { try { localStorage.removeItem(HANDOFF_KEY); } catch {} setHandoff(null); }} disabled={processingHandoff} style={hf.dismissBtn}>Dismiss</button>
          </div>
        </div>
      )}
      <div style={db.newRow}><input style={{ ...ps.input, flex: 1, marginTop: 0 }} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleNew()} placeholder="Name your invention (optional)..." /><button onClick={handleNew} style={ps.nextBtn}>Start New Application →</button></div>
      <BrainstormImportPicker onImport={handleImportFromBrainstorm} />
      {loading && <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading your applications…</p>}
      {!loading && projects.length > 0 && (<div style={db.list}><p style={db.listHeader}>SAVED APPLICATIONS ({projects.length})</p>{projects.map(p => (<div key={p.id} style={db.card}><div style={db.cardLeft}><div style={db.cardName}>{p.name}{p.data?.fromBrainstorm && <span style={hf.tag}>from Brainstorm</span>}{p.data?.importedBriefVersion && <span style={imp.briefTag}>{p.data.importedBriefVersion}</span>}{Array.isArray(p.data?.importedImages) && p.data.importedImages.length > 0 && <span style={hf.imgTag}>📎 {p.data.importedImages.length}</span>}</div><div style={db.cardMeta}>Last saved {new Date(p.updated_at).toLocaleString()} &nbsp;·&nbsp; Stage: <span style={{ color: theme.red }}>{sl(p.section)}</span></div></div><div style={db.cardRight}><button onClick={() => onResume(p)} style={db.resumeBtn}>Resume →</button><button onClick={() => handleRename(p.id)} style={db.iconBtn} title="Rename">✏</button><button onClick={() => handleDelete(p.id, p.name)} style={db.iconBtn} title="Delete">✕</button></div></div>))}</div>)}
      {!loading && projects.length === 0 && !handoff && <div style={db.empty}>No saved applications yet. Start your first one above.</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC SECTIONS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function StickyActionBar({ children, justSaved }) {
  return (
    <div style={ps.stickyBar}>
      {justSaved && <span style={ps.savedInline}>✓ Saved</span>}
      <div style={ps.stickyBarRight}>{children}</div>
    </div>
  );
}

function InventorSection({ data, setData, onNext, profileName, profileCity, profileState, profileCountry, profileEmail, justSaved }) {
  const [name, setName]       = useState(data.inventorName || "");
  const [city, setCity]       = useState(data.city || profileCity || "");
  const [stateVal, setStateVal] = useState(data.state || profileState || "");
  const [country, setCountry] = useState(data.country || profileCountry || "United States");
  const [email, setEmail]     = useState(data.email || profileEmail || "");
  const canProceed = name.trim() && city.trim() && stateVal.trim();
  const greetingLine = profileName && !data.inventorName ? `Drafting on behalf of ${profileName}? Fill in the details below — we've pre-filled what we can.` : null;
  return (
    <div style={ps.content}>
      <h2 style={ps.title}>Inventor Information</h2>
      <p style={ps.desc}>This is who will be named on the provisional patent application.</p>
      {greetingLine && <div style={hf.infoBar}>{greetingLine}</div>}
      {data.fromBrainstorm && <div style={hf.infoBar}>💡 Your Brainstorm session has been pre-loaded — title, field, brief, and any images you uploaded are ready in the next steps.</div>}

      <label style={ps.label}>Full Legal Name</label>
      <input style={ps.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Jane M. Smith — or your handle" />
      <p style={ps.helper}>Your handle works here too. The USPTO will need your legal name at filing, but you can keep it private in Patent Forge and add it to the filing documents you download later.</p>

      <label style={ps.label}>City</label><input style={ps.input} value={city} onChange={e => setCity(e.target.value)} placeholder="e.g., Decatur" />
      <label style={ps.label}>State / Province</label><input style={ps.input} value={stateVal} onChange={e => setStateVal(e.target.value)} placeholder="e.g., Georgia" />
      <label style={ps.label}>Country</label><input style={ps.input} value={country} onChange={e => setCountry(e.target.value)} />
      <label style={ps.label}>Email (optional)</label><input style={ps.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="For filing correspondence" />
      <StickyActionBar justSaved={justSaved}>
        <button onClick={() => { setData({ ...data, inventorName: name, city, state: stateVal, country, email }); onNext(); }} disabled={!canProceed} style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed", marginTop: 0 }}>Next: Our Vision →</button>
      </StickyActionBar>
    </div>
  );
}

function AgreementSection({ data, setData, onNext, hasAgreedBefore, justSaved }) {
  const [agreed, setAgreed] = useState(data.agreed || hasAgreedBefore || false);
  if (hasAgreedBefore && !data.fromBrainstorm) {
    return (
      <div style={ps.content}>
        <h2 style={ps.title}>Our Shared Vision</h2>
        <p style={ps.desc}>Continuing under HAIIC's shared vision — already on file from your previous applications.</p>
        <details style={ag.collapsed}>
          <summary style={ag.collapsedSummary}>View the vision again</summary>
          <div style={ag.collapsedBody}>
            <p style={ps.agreementText}>HAIIC was built on the belief that when AI helps create something valuable, the wealth it generates should flow back to the people AI affects most. Patent Forge is free because democratizing invention is the right thing to do.</p>
            <p style={ps.agreementText}>The model we live by distributes value equally: one third to the inventor; one third to programs supporting workers displaced by AI; and one third to AI safety research.</p>
            <p style={{ ...ps.agreementNote, marginTop: 12 }}>This is our compass, not a clause. Your invention is yours.</p>
          </div>
        </details>
        <StickyActionBar justSaved={justSaved}>
          <button onClick={() => { setData({ ...data, agreed: true }); onNext(); }} style={{ ...ps.nextBtn, marginTop: 0 }}>Continue: Title & Field →</button>
        </StickyActionBar>
      </div>
    );
  }
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
      <StickyActionBar justSaved={justSaved}>
        <button onClick={onNext} disabled={!agreed} style={{ ...ps.nextBtn, opacity: agreed ? 1 : 0.4, cursor: agreed ? "pointer" : "not-allowed", marginTop: 0 }}>I'm In — Next: Title & Field →</button>
      </StickyActionBar>
    </div>
  );
}

function TitleSection({ data, setData, onNext, justSaved }) {
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
      <StickyActionBar justSaved={justSaved}>
        <button onClick={() => { setData({ ...data, patentTitle: title, patentField: field, summary }); onNext(); }} disabled={!canProceed} style={{ ...ps.nextBtn, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed", marginTop: 0 }}>Next: Drafting →</button>
      </StickyActionBar>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function PatentForgePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [handle, setHandle] = useState("");
  const [profileName,    setProfileName]    = useState("");
  const [profileCity,    setProfileCity]    = useState("");
  const [profileState,   setProfileState]   = useState("");
  const [profileCountry, setProfileCountry] = useState("");
  const [profileEmail,   setProfileEmail]   = useState("");
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [hasAgreedBefore, setHasAgreedBefore] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [project, setProject] = useState(null);
  const [section, setSection] = useState(0);
  const [data, setData] = useState({});
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const loadProfileAndHistory = async (userId) => {
      const { data: profile } = await supabase.from("user_profiles").select("name, profile_categories").eq("user_id", userId).maybeSingle();
      const cleanName = (profile?.name || "").trim();
      setHandle(cleanName || "Inventor");
      setProfileName(cleanName);
      setProfileCity(profile?.profile_categories?.city || "");
      setProfileState(profile?.profile_categories?.state || "");
      setProfileCountry(profile?.profile_categories?.country || "");
      setProfileEmail(profile?.profile_categories?.email || "");
      const { data: priorProjects } = await supabase.from(TABLE).select("id, data").eq("user_id", userId);
      const noPriorProjects = !priorProjects || priorProjects.length === 0;
      setIsFirstTimeUser(noPriorProjects);
      const everAgreed = Array.isArray(priorProjects) && priorProjects.some(p => p?.data?.agreed === true);
      setHasAgreedBefore(everAgreed);
    };
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login?next=/patent-forge"); return; }
      setUser(session.user);
      loadProfileAndHistory(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/login?next=/patent-forge");
      else { setUser(session.user); loadProfileAndHistory(session.user.id); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!project || authLoading) return;
    const timer = setTimeout(async () => {
      await supabase.from(TABLE).update({ section, data, updated_at: new Date().toISOString() }).eq("id", project.id);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
    }, 800);
    return () => clearTimeout(timer);
  }, [section, data]);

  const handleSetData = (newData) => setData(newData);
  const goNext = () => setSection(s => Math.min(s + 1, SECTIONS.length - 1));
  const goToSection = (t) => { if (t < section) setSection(t); };
  const handleNew = (proj) => { setProject(proj); setSection(proj.section || 0); setData(proj.data || {}); setView("session"); };
  const handleResume = (proj) => { setProject(proj); setSection(proj.section || 0); setData(proj.data || {}); setView("session"); };
  const handleDashboard = async () => { if (project) await supabase.from(TABLE).update({ section, data, updated_at: new Date().toISOString() }).eq("id", project.id); setView("dashboard"); setProject(null); setSection(0); setData({}); };
  const handleSave = async () => {
    if (!project) return;
    await supabase.from(TABLE).update({ section, data, updated_at: new Date().toISOString() }).eq("id", project.id);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };
  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  if (authLoading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#888", fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}>Loading…</div>;

  if (view === "dashboard") {
    return (
      <Layout title="Patent Forge" logoSrc="/patentforge-logo.png">
        <div style={styles.header}><p style={styles.label}>PATENT FORGE</p><h1 style={styles.heading}>Draft Your Provisional Patent</h1></div>
        <ProjectDashboard onNew={handleNew} onResume={handleResume} onSignOut={handleSignOut} handle={handle} isFirstTimeUser={isFirstTimeUser} userId={user?.id} />
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
          <button onClick={handleSave} style={tb.btn}>{justSaved ? "✓ Saved" : "💾 Save"}</button>
          <span style={tb.userHandle}>{handle}</span>
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
      {section === 0 && <InventorSection    data={data} setData={handleSetData} onNext={goNext} profileName={profileName} profileCity={profileCity} profileState={profileState} profileCountry={profileCountry} profileEmail={profileEmail} justSaved={justSaved} />}
      {section === 1 && <AgreementSection   data={data} setData={handleSetData} onNext={goNext} hasAgreedBefore={hasAgreedBefore} justSaved={justSaved} />}
      {section === 2 && <TitleSection       data={data} setData={handleSetData} onNext={goNext} justSaved={justSaved} />}
      {section === 3 && <DraftingSection    project={project} data={data} setData={handleSetData} handle={handle} userId={user?.id} />}
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  header: { marginBottom: 24 },
  label: { color: theme.red, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 },
  heading: { fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: theme.text },
  sections: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 32, paddingBottom: 20, borderBottom: `1px solid ${theme.border}` },
  sectionChip: { border: "1px solid", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s ease" },
};
const pg = {
  twoCol: { display: "flex", gap: 20, height: "calc(100vh - 240px)", minHeight: 500 },
  leftCol: { flex: 1, minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingRight: 4 },
  rightCol: { width: 320, flexShrink: 0, overflowY: "auto", paddingLeft: 4 },
};
const sb = {
  wrap: { display: "flex", flexDirection: "column", gap: 20 },
  section: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14 },
  sectionLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 2, color: theme.textDim, marginBottom: 10, marginTop: 0 },
  count: { color: theme.red, marginLeft: 4 },
  phaseList: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 },
  phaseItem: { fontSize: 13, fontFamily: "'DM Sans', sans-serif" },
  advanceBtn: { width: "100%", background: theme.red, border: "none", borderRadius: 6, color: "#fff", padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 8 },
  emptyHint: { fontSize: 11, color: theme.textDim, fontStyle: "italic", margin: 0, lineHeight: 1.5 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  card: { background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 7, padding: 10 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  cardTitle: { fontSize: 12, fontWeight: 700, color: theme.text, flex: 1, lineHeight: 1.4 },
  cardActions: { display: "flex", gap: 2 },
  iconBtn: { background: "transparent", border: "none", color: theme.textDim, padding: "2px 5px", fontSize: 11, cursor: "pointer", borderRadius: 3 },
  cardContent: { fontSize: 11, color: theme.textMuted, lineHeight: 1.5 },
};
const ca = {
  divider: { textAlign: "center", padding: "12px 16px", margin: "16px 0", background: theme.surfaceAlt, border: `1px dashed ${theme.red}`, borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 2, color: theme.red, textTransform: "uppercase" },
};
const ed = {
  wrap: { background: "#1a1a1a", border: `2px solid ${theme.red}`, borderRadius: 10, padding: 18, marginTop: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${theme.border}` },
  headerTitle: { fontSize: 13, fontWeight: 700, color: theme.text, letterSpacing: 1 },
  closeBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  label: { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: theme.textDim, marginTop: 12, marginBottom: 6 },
  input: { width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, padding: "8px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none" },
  textarea: { width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, padding: "8px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", resize: "vertical", outline: "none" },
  preview: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 13, color: theme.text, lineHeight: 1.5, whiteSpace: "pre-wrap" },
  row: { display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" },
  saveBtn: { background: theme.red, border: "none", borderRadius: 6, color: "#fff", padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  cancelBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};
const dm = {
  backdrop: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#1a1a1a", border: `1px solid ${theme.red}`, borderRadius: 10, padding: 24, maxWidth: 440, width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" },
  title: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: theme.text, marginTop: 0, marginBottom: 12 },
  body: { fontSize: 13, color: theme.textMuted, lineHeight: 1.6, marginBottom: 10 },
  input: { width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none", marginTop: 4 },
  row: { display: "flex", gap: 10, marginTop: 16 },
  deleteBtn: { background: theme.red, border: "none", borderRadius: 6, color: "#fff", padding: "8px 16px", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" },
  cancelBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};
const ps = {
  content:  { marginTop: 8 },
  title:    { fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: theme.text, marginBottom: 12 },
  desc:     { fontSize: 15, lineHeight: 1.7, color: theme.textMuted, marginBottom: 16 },
  label:    { display: "block", fontSize: 13, fontWeight: 600, color: theme.textMuted, marginBottom: 6, marginTop: 16 },
  hint:     { fontSize: 12, color: theme.textDim, marginTop: 4 },
  helper:   { fontSize: 12, color: theme.textDim, marginTop: 6, marginBottom: 4, lineHeight: 1.5, fontStyle: "italic" },
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
  stickyBar: { position: "sticky", bottom: 0, background: "#1a1a1a", borderTop: `1px solid ${theme.border}`, marginTop: 24, padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, zIndex: 5 },
  stickyBarRight: { display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" },
  savedInline: { fontSize: 12, fontWeight: 700, color: "#80ff99", letterSpacing: 1 },
};
const wb = {
  banner: { background: theme.surface, border: `1px solid ${theme.red}`, borderRadius: 10, padding: "16px 20px", marginBottom: 24, display: "flex", gap: 14, alignItems: "flex-start" },
  icon: { fontSize: 24, lineHeight: 1, flexShrink: 0, marginTop: 2 },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 6 },
  text: { fontSize: 13, color: theme.textMuted, lineHeight: 1.6, margin: 0 },
};
const ag = {
  collapsed: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 },
  collapsedSummary: { fontSize: 13, color: theme.red, fontWeight: 600, cursor: "pointer", listStyle: "revert" },
  collapsedBody: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.border}` },
};
const imp = {
  wrap: { marginTop: -8, marginBottom: 24 },
  toggle: { background: "transparent", border: "none", color: theme.red, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 0", fontFamily: "'DM Sans', sans-serif" },
  panel: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 18, marginTop: 8 },
  constraint: { fontSize: 12, color: theme.textMuted, lineHeight: 1.6, marginBottom: 14, marginTop: 0, padding: "10px 12px", background: theme.surfaceAlt, borderRadius: 6, border: `1px solid ${theme.border}` },
  loadingMsg: { color: theme.textMuted, fontSize: 13, fontStyle: "italic", margin: "8px 0" },
  emptyMsg: { color: theme.textMuted, fontSize: 13, lineHeight: 1.6, padding: "12px 0", margin: 0 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: { background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "10px 14px" },
  rowDim: { opacity: 0.55 },
  rowMain: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  rowLeft: { flex: 1, minWidth: 200 },
  rowName: { fontSize: 14, fontWeight: 600, color: theme.text, marginBottom: 3 },
  rowMeta: { fontSize: 12, color: theme.textDim },
  versionLabel: { color: theme.text, fontWeight: 600 },
  noBriefIndicator: { color: theme.textDim, fontStyle: "italic" },
  useBtn: { background: theme.red, border: "none", borderRadius: 6, color: "#fff", padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" },
  useBtnDisabled: { color: theme.textDim, fontSize: 18, padding: "7px 14px", fontWeight: 700 },
  rowInstruction: { fontSize: 12, color: theme.textMuted, lineHeight: 1.6, marginTop: 8, marginBottom: 0, paddingTop: 8, borderTop: `1px dashed ${theme.border}`, fontStyle: "italic" },
  briefTag: { background: theme.surfaceAlt, color: theme.textMuted, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, marginLeft: 6, verticalAlign: "middle", border: `1px solid ${theme.border}` },
  imgTag: { background: theme.surfaceAlt, color: theme.textMuted, fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3, marginLeft: 6, border: `1px solid ${theme.border}` },
};
const db = {
  topRow:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  userRow:    { display: "flex", alignItems: "center", gap: 10 },
  userHandle: { fontSize: 13, color: theme.red, fontWeight: 700 },
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
  userHandle:  { fontSize: 12, color: theme.red, fontWeight: 700 },
  signOutBtn:  { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.textMuted, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};
const hf = {
  banner: { background: theme.surface, border: `1px solid ${theme.red}`, borderRadius: 10, padding: "14px 18px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  bannerLeft: { flex: 1, minWidth: 240 },
  bannerTitle: { fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 4 },
  bannerMeta: { fontSize: 12, color: theme.textMuted },
  bannerRight: { display: "flex", gap: 8, alignItems: "center" },
  continueBtn: { background: theme.red, border: "none", borderRadius: 7, color: "#fff", padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  dismissBtn: { background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 7, color: theme.textMuted, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  infoBar: { background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: theme.textMuted },
  tag: { background: theme.red, color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, marginLeft: 8, verticalAlign: "middle" },
  imgTag: { background: theme.surfaceAlt, color: theme.textMuted, borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 600, marginLeft: 6, border: `1px solid ${theme.border}` },
};
const na = {
  wrap:        { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden" },
  toggle:      { width: "100%", background: "transparent", border: "none", color: theme.textMuted, padding: "12px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 12 },
  scoreInline: { fontWeight: 700, fontSize: 14, letterSpacing: 0.5 },
  panel:       { padding: 18, borderTop: `1px solid ${theme.border}` },
  intro:       { fontSize: 13, color: theme.textMuted, lineHeight: 1.6, marginBottom: 16, marginTop: 0 },
  loadingMsg:  { color: theme.textMuted, fontSize: 13, fontStyle: "italic", margin: 0 },
  result:      { background: theme.surfaceAlt, borderRadius: 8, padding: 16, marginBottom: 16 },
  resultText:  { fontSize: 13, lineHeight: 1.7, color: theme.text, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'DM Sans', sans-serif", margin: 0 },
  threadWrap:  { marginBottom: 12 },
  msg:         { padding: "8px 12px", borderRadius: 6, marginBottom: 6 },
  msgRole:     { fontSize: 12, fontWeight: 700, marginRight: 6 },
  msgText:     { fontSize: 13, color: theme.textMuted, lineHeight: 1.6 },
  followRow:   { display: "flex", gap: 8, marginBottom: 8 },
  followInput: { flex: 1, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 7, color: theme.text, padding: "8px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" },
  askBtn:      { background: theme.red, border: "none", borderRadius: 7, color: "#fff", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};
