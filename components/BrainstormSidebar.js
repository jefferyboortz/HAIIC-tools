import theme from "./theme";

// Sidebar for the unified-chat Brainstorm architecture.
// Renders the project's captured artifacts as cards in the order they were approved.
// Push 1 keeps it simple: list of cards, each shows title + a short snippet.
// Future pushes add: click-to-expand (center stage), spinoff pills, pending enrichments tab.

const PHASE_LABELS = {
  intake:   "Getting to know you",
  problem:  "Defining the problem",
  explore:  "Exploring the problem",
  ideate:   "Brainstorming",
  refine:   "Refining the idea",
  brief:    "Invention Brief",
};

const CAPTURE_TYPE_LABELS = {
  problem:    "Problem Statement",
  explore:    "Root Causes",
  ideate:     "Idea Set",
  refine:     "Refined Invention",
  brief:      "Invention Brief",
  insight:    "Insight",
};

export default function BrainstormSidebar({
  currentPhase,
  captures,
  onSave,
  onExport,
  saving,
  justSaved,
}) {
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

        {captures.map((cap) => (
          <div key={cap.id} style={styles.card}>
            <div style={styles.cardLabel}>
              {CAPTURE_TYPE_LABELS[cap.type] || "Captured"}
            </div>
            <div style={styles.cardTitle}>{cap.title || "Untitled capture"}</div>
            {cap.content && (
              <div style={styles.cardSnippet}>
                {cap.content.length > 140 ? cap.content.slice(0, 140) + "…" : cap.content}
              </div>
            )}
          </div>
        ))}
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
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: "12px 14px",
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
  },
};
