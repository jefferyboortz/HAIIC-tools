import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import supabase from "../lib/supabaseClient";
import theme from "./theme";
import ReportProblemModal from "./ReportProblemModal";

export default function Layout({ children, title, logoSrc }) {
  const router = useRouter();
  const [authState, setAuthState] = useState("loading");
  const [displayName, setDisplayName] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (session) => {
      if (!session) {
        if (mounted) {
          setAuthState("signedOut");
          setDisplayName(null);
        }
        return;
      }
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!mounted) return;
      setAuthState("signedIn");
      setDisplayName((profile?.name || "").trim() || "Profile");
    };

    supabase.auth.getSession().then(({ data: { session } }) => loadProfile(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

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
            <span style={styles.navDivider}>|</span>
            {authState === "signedIn" && (
              <button
                onClick={() => setReportOpen(true)}
                style={styles.reportBtn}
                title="Report a problem or share feedback"
              >
                Report a Problem
              </button>
            )}
            {authState === "loading" && <span style={styles.navMuted}>…</span>}
            {authState === "signedIn" && (
              <Link href="/profile" style={styles.navAccount}>{displayName}</Link>
            )}
            {authState === "signedOut" && (
              <Link
                href={`/login?next=${encodeURIComponent(router.asPath || "/")}`}
                style={styles.navLink}
              >
                Sign In
              </Link>
            )}
          </div>
        </nav>
        <main style={styles.main}>{children}</main>
        <footer style={styles.footer}>
          <p style={styles.footerText}>
            © 2026 Human-AI Innovation Commons · 501(c)(3) Nonprofit · Decatur, Georgia
            <span style={styles.footerDivider}> · </span>
            <Link href="/privacy" style={styles.footerLink}>Privacy</Link>
          </p>
        </footer>
      </div>
      <ReportProblemModal open={reportOpen} onClose={() => setReportOpen(false)} />
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
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 22,
    fontWeight: 700,
    color: theme.text,
    letterSpacing: 2,
  },
  navLinks: { display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" },
  navLink: {
    color: theme.textMuted,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
    transition: "color 0.2s",
  },
  navDivider: {
    color: theme.textDim,
    fontSize: 14,
    userSelect: "none",
  },
  navAccount: {
    color: theme.red,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
    transition: "color 0.2s",
  },
  navMuted: {
    color: theme.textDim,
    fontSize: 14,
  },
  reportBtn: {
    background: "transparent",
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    color: theme.textMuted,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.2s",
  },
  main: { flex: 1, maxWidth: 900, width: "100%", margin: "0 auto", padding: "40px 24px" },
  footer: {
    padding: "24px 32px",
    borderTop: `1px solid ${theme.border}`,
    textAlign: "center",
  },
  footerText: { color: theme.textDim, fontSize: 12 },
  footerDivider: { color: theme.textDim },
  footerLink: { color: theme.textMuted, textDecoration: "underline" },
};
