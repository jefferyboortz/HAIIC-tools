import Link from "next/link";
import Layout from "../components/Layout";
import theme from "../components/theme";

export default function Home() {
  return (
    <Layout title="HAIC Tools">
      <div style={styles.hero}>
        <p style={styles.tagline}>Human-AI Innovation Commons</p>
        <h1 style={styles.heroTitle}>Democratizing the Patent System</h1>
        <p style={styles.heroDesc}>
          Two AI-powered tools that transform patent filing from a $10,000–$15,000 professional
          service into a guided conversation anyone can use. Every patent enters our irrevocable
          three-way benefit-sharing framework.
        </p>
      </div>

      <div style={styles.pipeline}>
        <p style={styles.pipelineLabel}>THE INVENTOR PIPELINE</p>
        <div style={styles.cards}>
          <Link href="/brainstorm" style={styles.card}>
            <div style={styles.cardIcon}>💡</div>
            <h2 style={styles.cardTitle}>Brainstorm</h2>
            <p style={styles.cardDesc}>
              An AI coach that helps you identify patentable innovations hiding in your existing
              expertise. Through guided conversation, it draws out ideas you didn't realize had
              commercial value.
            </p>
            <div style={styles.cardPhases}>
              <span style={styles.phase}>Your Expertise</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Define Problem</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Explore</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Brainstorm</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Refine</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Invention Brief</span>
            </div>
            <div style={styles.cardCta}>Start Brainstorming →</div>
          </Link>

          <Link href="/patent-forge" style={styles.card}>
            <div style={styles.cardIcon}>⚒️</div>
            <h2 style={styles.cardTitle}>Patent Forge</h2>
            <p style={styles.cardDesc}>
              Walks you through every section of a provisional patent application with real-time AI
              guidance on claims drafting, prior art, and technical specifications.
            </p>
            <div style={styles.cardPhases}>
              <span style={styles.phase}>Inventor Info</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Benefit-Sharing Agreement</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Title & Field</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Description</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Claims</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.phase}>Filing Package</span>
            </div>
            <div style={styles.cardCta}>Start Your Patent →</div>
          </Link>
        </div>
      </div>

      <div style={styles.framework}>
        <p style={styles.pipelineLabel}>BENEFIT-SHARING FRAMEWORK</p>
        <h2 style={styles.frameworkTitle}>Every patent. Three-way split. Irrevocable.</h2>
        <div style={styles.splits}>
          <div style={styles.split}>
            <div style={styles.splitPct}>⅓</div>
            <div style={styles.splitLabel}>Human Inventor</div>
            <p style={styles.splitDesc}>The person whose expertise created the innovation</p>
          </div>
          <div style={styles.split}>
            <div style={styles.splitPct}>⅓</div>
            <div style={styles.splitLabel}>Displaced Workers</div>
            <p style={styles.splitDesc}>Programs supporting workers affected by AI automation</p>
          </div>
          <div style={styles.split}>
            <div style={styles.splitPct}>⅓</div>
            <div style={styles.splitLabel}>AI Safety Research</div>
            <p style={styles.splitDesc}>Ensuring AI development benefits everyone</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

const styles = {
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
  cardIcon: { fontSize: 32, marginBottom: 12 },
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
    gap: 6,
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
  },
  frameworkTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 24,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 24,
  },
  splits: { display: "flex", gap: 24 },
  split: { flex: 1, textAlign: "center" },
  splitPct: { fontSize: 36, fontWeight: 700, color: theme.red, marginBottom: 8 },
  splitLabel: { fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 6 },
  splitDesc: { fontSize: 13, color: theme.textMuted, lineHeight: 1.5 },
};
