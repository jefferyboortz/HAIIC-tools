import theme from "./theme";

// Sidebar for the unified-chat Brainstorm architecture.
// - Phase progress tally
// - Captures list with Edit button on each card

const PHASE_LABELS = {
  intake:   "Getting to know you",
  problem:  "Defining the problem",
  explore:  "Exploring the problem",
  ideate:   "Brainstorming",
  refine:   "Refining the idea",
  brief:    "Invention Brief",
};

const PHASE_SHORT = {
  intake:  "Intake",
  problem: "Define problem",
  explore: "Explore",
  ideate:  "Brainstorm",
  refine:  "Refine",
  brief:   "Brief",
};

const PHASE_ORDER = ["intake", "problem", "explore", "ideate", "refine", "brief"];

const CAPTURE_TYPE_LABELS = {
  problem:    "Problem Statement",
  explore:    "Root Causes",
  ideate:     "Idea Set",
  refine:     "Refined Invention",
  brief:      "Invention Brief",
  insight:    "Insight",
};

const CAPTURE_COMPLETES_PHASE = {
  problem: "problem",
  explore: "explore",
  ideate:  "ideate",
  refine:  "refine",
  brief:   "brief",
};

export default function BrainstormSidebar({
  currentPhase,
  captures,
  onSave,
  onExport,
  onEditCapture,
  editingCaptureId,
  saving,
  justSaved,
}) {
  const completedPhases = new Set();
  for (const cap of captures) {
    const p = CAPTURE_COMPLETES_PHASE[cap.type];
    if (p) completedPhases.add(p);
  }
  if (currentPhase !== "intake") completedPhases.add("intake");

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <p style={styles.headerLabel}>SESSION</p>
        <p style={styles.headerPhase}>{PHASE_LABELS[currentPhase] || "In progress"}</p>
      </div>

      <div style={styles.toolbar}>
        <button onClick={onSave} disabled={saving} style={styles.toolBtn}>
          {justSaved ? "✓ Saved" : saving ? "Saving…" : "💾 Save"}
        </button>
        <button onClick={onExport} style={styles.toolBtn}>
          ⬇ Export
        </button>
      </div>

      <div style={styles.progressSection}>
        <p style={styles.sectionLabel}>PROGRESS</p>
        <div style={styles.progressList}>
          {PHASE_ORDER.map((phase) => {
            const isCompleted = completedPhases.has(phase) && phase !== currentPhase;
            const isCurrent = phase === currentPhase;

            let marker, markerStyle, labelStyle;
            if (isCompleted) {
              marker = "✓";
              markerStyle = styles.markerDone;
              labelStyle = styles.labelDone;
            } else if (isCurrent) {
              marker = "●";
              markerStyle = styles.markerCurrent;
              labelStyle = styles.labelCurrent;
            } else {
              marker = "○";
              markerStyle = styles.markerUpcoming;
              labelStyle = styles.labelUpcoming;
            }

            return (
              <div key={phase} style={styles.progressRow}>
                <span style={{ ...styles.marker, ...markerStyle }}>{marker}</span>
                <span style={{ ...styles.progressLabel, ...labelStyle }}>
                  {PHASE_SHORT[phase]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.capturesSection}>
        <p style={styles.sectionLabel}>CAPTURES ({captures.length})</p>

        {captures.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyText}>
              As your invention takes shape, key ideas will be captured here for review.
            </p>
            <p style={styles.emptyHint}>Keep chatting — I'll let you know when something's worth capturing.</p>
          </div>
        )}

        {captures.map((cap) => {
          const isBeingEdited = cap.id === editingCaptureId;
          return (
            <div
              key={cap.id}
              style={{
                ...styles.card,
                opacity: isBeingEdited ? 0.5 : 1,
                borderColor: isBeingEdited ? theme.red : theme.border,
              }}
            >
              <div style={styles.cardLabel}>
                {CAPTURE_TYPE_LABELS[cap.type] || "Captured"}
              </div>
              <div style={styles.cardTitle}>{cap.title || "Untitled capture"}</div>
              {cap.content && (
                <div style={styles.cardSnippet}>
                  {cap.content.length > 140 ? cap.content.slice(0, 140) + "…" : cap.content}
                </div>
              )}
              <div style={styles.cardActions}>
                {isBeingEdited ? (
                  <span style={styles.editingTag}>Editing in chat…</span>
                ) : (
                  <button
                    onClick={() => onEditCapture(cap.id)}
                    style={styles.editBtn}
                    title="Edit this capture"
                  >
                    ✏ Edit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 320,
    flexShrink: 0,
    borderLeft: `1px solid ${theme.border}`,
    background: "#141414",
    padding: "20px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    overflowY: "auto",
    height: "100%",
  },
  header: { paddingBottom: 12, borderBottom: `1px solid ${theme.border}` },
  headerLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    color: theme.textDim,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  headerPhase: {
    fontSize: 14,
    fontWeight: 700,
    color: theme.text,
    margin: 0,
  },
  toolbar: { display: "flex", gap: 8 },
  toolBtn: {
    flex: 1,
    background: "transparent",
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    color: theme.textMuted,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },

  progressSection: { display: "flex", flexDirection: "column", gap: 8 },
  progressList: { display: "flex", flexDirection: "column", gap: 6 },
  progressRow: { display: "flex", alignItems: "center", gap: 10 },
  marker: { fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 },
  markerDone:     { color: "#80ff99" },
  markerCurrent:  { color: theme.red },
  markerUpcoming: { color: theme.textDim },
  progressLabel: { fontSize: 12, fontFamily: "'DM Sans', sans-serif" },
  labelDone:     { color: theme.textMuted, textDecoration: "line-through", textDecorationColor: theme.textDim },
  labelCurrent:  { color: theme.text, fontWeight: 700 },
  labelUpcoming: { color: theme.textDim },

  capturesSection: { display: "flex", flexDirection: "column", gap: 10 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    color: theme.textDim,
    margin: 0,
    textTransform: "uppercase",
  },
  empty: {
    background: theme.surface,
    border: `1px dashed ${theme.border}`,
    borderRadius: 8,
    padding: "14px 14px",
  },
  emptyText: {
    fontSize: 12,
    color: theme.textMuted,
    lineHeight: 1.5,
    margin: 0,
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 11,
    color: theme.textDim,
    lineHeight: 1.5,
    margin: 0,
    fontStyle: "italic",
  },
  card: {
    background: theme.surface,
    border: "1px solid",
    borderRadius: 8,
    padding: "12px 14px",
    transition: "opacity 0.15s ease, border-color 0.15s ease",
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: theme.red,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.text,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  cardSnippet: {
    fontSize: 12,
    color: theme.textMuted,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  cardActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  editBtn: {
    background: "transparent",
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    color: theme.textMuted,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  editingTag: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    color: theme.red,
    textTransform: "uppercase",
    fontStyle: "italic",
  },
};
