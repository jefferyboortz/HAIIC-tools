import Head from "next/head";
import Link from "next/link";
import theme from "./theme";

export default function Layout({ children, title, logoSrc }) {
  return (
    <>
      <Head>
        <title>{title || "HAIC Tools"} — Human-AI Innovation Commons</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div style={styles.app}>
        <nav style={styles.nav}>
          <Link href="/" style={styles.logo}>
            {logoSrc ? (
              <img src={logoSrc} alt={title || "HAIC"} style={styles.logoImg} />
            ) : (
              <>
                <img src="/favicon.png" alt="HAIC" style={styles.logoIcon} />
                <span style={styles.logoText}>HAIIC Tools</span>
              </>
            )}
          </Link>
          <div style={styles.navLinks}>
            <Link href="/brainstorm" style={styles.navLink}>Brainstorm</Link>
            <Link href="/patent-forge" style={styles.navLink}>Patent Forge</Link>
          </div>
        </nav>
        <main style={styles.main}>{children}</main>
        <footer style={styles.footer}>
          <p style={styles.footerText}>
            © 2026 Human-AI Innovation Commons · 501(c)(3) Nonprofit · Decatur, Georgia
          </p>
        </footer>
      </div>
    </>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: theme.bg,
    color: theme.text,
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 32px",
    borderBottom: `1px solid ${theme.border}`,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  },
  logoMark: { color: theme.red, fontSize: 24 },
  logoImg: { height: 36 },
  logoIcon: { height: 32, width: 32, borderRadius: 6 },
  logoText: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    fontWeight: 700,
    color: theme.text,
    letterSpacing: 2,
  },
  navLinks: { display: "flex", gap: 24 },
  navLink: {
    color: theme.textMuted,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
    transition: "color 0.2s",
  },
  main: { flex: 1, maxWidth: 900, width: "100%", margin: "0 auto", padding: "40px 24px" },
  footer: {
    padding: "24px 32px",
    borderTop: `1px solid ${theme.border}`,
    textAlign: "center",
  },
  footerText: { color: theme.textDim, fontSize: 12 },
};
