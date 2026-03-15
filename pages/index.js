import Link from "next/link";
import Layout from "../components/Layout";
import theme from "../components/theme";

export default function Home() {
  return (
    <Layout title="HAIC Tools">

      {/* Storage warning banner */}
      <div style={styles.storageBanner}>
        💾 <strong>Save tip:</strong> Your projects are saved to this browser only. Export your .docx regularly as a backup — and avoid clearing your browser history mid-session.
      </div>

      <div style={styles.hero}>
        <p style={styles.tagline}>Human-AI Innovation Commons</p>
        <h1 style={styles.heroTitle}>Democratizing the Patent System</h1>
        <p style={styles.heroDesc}>
          Two AI-powered tools that transform patent filing from a $10,000–$15,000 professional
          service into a guided conversation anyone can use.
        </p>
      </div>

      <div style={styles.pipeline}>
        <p style={styles.pipelineLabel}>THE INVENTOR PIPELINE</p>
        <div style={styles.cards}>

          <Link href="/brainstorm" style={styles.card}>
            <div style={styles.cardHeader}>
              <img src="/brainstorm-logo.png" alt="Brainstorm" style={styles.cardLogo} />
            </div>
            <h2 style={styles.cardTitle}>Brainstorm</h2>
            <p style={styles.cardDesc}>
              An AI coach that helps you identify patentable innovations hiding in your existing
              expertise. Through guided conversation, it draws out ideas you didn't realize had
              commercial value.
            </p>
            <div style={styles.cardPhases}>
              {["Your Expertise","Define Problem","Explore","Brainstorm","Refine","Invention Brief"].map((p, i, arr) => (
                <span key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={styles.phase}>{p}</span>
                  {i < arr.length - 1 && <span style={styles.arrow}>→</span>}
                </span>
              ))}
            </div>
            <div style={styles.cardCta}>Start Brainstorming →</div>
          </Link>

          <Link href="/patent-forge" style={styles.card}>
            <div style={styles.cardHeader}>
              <img src="/patentforge-logo.png" alt="Patent Forge" style={styles.cardLogo} />
            </div>
            <h2 style={styles.cardTitle}>Patent Forge</h2>
            <p style={styles.cardDesc}>
              Walks you through every section of a provisional patent application with real-time AI
              guidance on claims drafting, prior art, and technical specifications.
            </p>
            <div style={styles.cardPhases}>
              {["Inventor Info","Our Vision","Title & Field","Description","Claims","Filing Package"].map((p, i, arr) => (
                <span key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={styles.phase}>{p}</span>
                  {i < arr.length - 1 && <span style={styles.arrow}>→</span>}
                </span>
              ))}
            </div>
            <div style={styles.cardCta}>Start Your Patent →</div>
          </Link>

        </div>
      </div>

      <div style={styles.framework}>
        <p style={styles.pipelineLabel}>OUR SHARED VISION</p>
        <h2 style={styles.frameworkTitle}>Built for inventors, not corporations.</h2>
        <p style={styles.frameworkDesc}>
          We're not asking you to sign a contract — we're inviting you into a vision.
          When AI helps create something valuable, we believe the wealth should flow back
          to the people AI affects most. Here's the model we live by:
        </p>
        <div style={styles.splits}>
          <div style={styles.split}>
            <div style={styles.splitPct}>⅓</div>
            <div style={styles.splitLabel}>The Inventor</div>
            <p style={styles.splitDesc}>You brought the expertise and lived experience. That deserves to be rewarded.</p>
          </div>
          <div style={styles.split}>
            <div style={styles.splitPct}>⅓</div>
            <div style={styles.splitLabel}>Displaced Workers</div>
            <p style={styles.splitDesc}>AI is reshaping the workforce. Those most affected deserve a share of what it creates.</p>
          </div>
          <div style={styles.split}>
            <div style={styles.splitPct}>⅓</div>
            <div style={styles.splitLabel}>AI Safety Research</div>
            <p style={styles.splitDesc}>So that AI keeps working for everyone — not just those who own it.</p>
          </div>
        </div>
        <p style={styles.compass}>This is our compass, not a clause.</p>
      </div>

    </Layout>
  );
}

const styles = {
  storageBanner: {
    background: theme.surfaceAlt,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 13,
    color: theme.textMuted,
    lineHeight: 1.5,
    marginBottom: 32,
  },
  hero: { textAlign: "center", marginBottom: 60 },
  tagline: {
    color: theme.red,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 42,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 20,
    lineHeight: 1.2,
  },
  heroDesc: {
    fontSize: 16,
    lineHeight: 1.7,
    color: theme.textMuted,
    maxWidth: 640,
    margin: "0 auto",
  },
  pipeline: { marginBottom: 60 },
  pipelineLabel: {
    color: theme.red,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 24,
  },
  cards: { display: "flex", flexDirection: "column", gap: 24 },
  card: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 32,
    textDecoration: "none",
    transition: "border-color 0.2s",
    cursor: "pointer",
  },
  cardHeader: { marginBottom: 16 },
  cardLogo: { height: 40, width: "auto", display: "block" },
  cardTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 26,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 12,
  },
  cardDesc: { fontSize: 15, lineHeight: 1.7, color: theme.textMuted, marginBottom: 20 },
  cardPhases: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
    marginBottom: 20,
  },
  phase: {
    background: theme.surfaceAlt,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: 600,
  },
  arrow: { color: theme.textDim, fontSize: 12 },
  cardCta: { color: theme.red, fontWeight: 700, fontSize: 14 },
  framework: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: 32,
    marginBottom: 40,
  },
  frameworkTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 24,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 12,
  },
  frameworkDesc: {
    fontSize: 14,
    lineHeight: 1.7,
    color: theme.textMuted,
    marginBottom: 24,
    maxWidth: 600,
  },
  splits: { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 },
  split: { flex: 1, textAlign: "center", minWidth: 140 },
  splitPct: { fontSize: 36, fontWeight: 700, color: theme.red, marginBottom: 8 },
  splitLabel: { fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 6 },
  splitDesc: { fontSize: 13, color: theme.textMuted, lineHeight: 1.5 },
  compass: {
    fontSize: 13,
    color: theme.textDim,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
};
