import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import theme from "../components/theme";

const supabase = createClient(
  "https://quruzppflgdbddxyylxu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnV6cHBmbGdkYmRkeHl5bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDQ1NTEsImV4cCI6MjA4OTE4MDU1MX0.y6acgCo6EZZiEDIJHSx6J3T60L1P6M_DH3vTIulFvJ0"
);

export default function LoginPage() {
  const router = useRouter();
  const next = router.query.next || "/";
  const isForge = next.includes("patent-forge");
  const logoSrc = isForge ? "/patentforge-logo.png" : "/brainstorm-logo.png";
  const toolName = isForge ? "Patent Forge" : "Brainstorm";

  const [mode,     setMode]     = useState("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(null);

  // MFA challenge state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const proceedAfterSignIn = async () => {
    // Check if the user has a verified TOTP factor; if so, prompt for MFA
    try {
      const { data, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalErr) throw aalErr;

      // currentLevel: "aal1" or "aal2"; nextLevel: what user needs for full access
      if (data?.nextLevel === "aal2" && data?.currentLevel !== "aal2") {
        const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
        if (fErr) throw fErr;
        const verified = (factors?.totp || []).find((f) => f.status === "verified");
        if (verified) {
          setMfaFactorId(verified.id);
          setMfaRequired(true);
          setLoading(false);
          return;
        }
      }
      // No MFA needed — proceed to destination
      router.push(router.query.next || "/");
    } catch (err) {
      setError(err.message || "Sign-in worked, but we hit a snag confirming your account. Please try again.");
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        // With email confirmation enabled, signUp does NOT create a session;
        // the user has to click the link in their email first.
        setSuccess("Check your email — we sent you a link to confirm your account. Once you click it, come back here and sign in.");
        setMode("login");
        setLoading(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        await proceedAfterSignIn();
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    setError(null);
    const trimmed = mfaCode.trim();
    if (trimmed.length !== 6 || !/^\d+$/.test(trimmed)) {
      setError("The code is six digits. Take a look at your authenticator app.");
      return;
    }
    setMfaVerifying(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: trimmed,
      });
      if (vErr) throw vErr;
      router.push(router.query.next || "/");
    } catch (err) {
      setError(err.message || "That code didn't match. The codes change every 30 seconds — try the newest one.");
      setMfaVerifying(false);
    }
  };

  const handleMfaCancel = async () => {
    // User backed out of MFA — sign them out so we don't leave a half-authenticated session
    try { await supabase.auth.signOut(); } catch {}
    setMfaRequired(false);
    setMfaFactorId(null);
    setMfaCode("");
    setError(null);
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <img src={logoSrc} alt={toolName} style={s.logo} />
          <p style={s.attribution}>A Human-AI Innovation Commons Tool</p>
          <p style={s.subtitle}>Your invention sessions, saved securely across any device.</p>
        </div>

        {mfaRequired ? (
          <>
            <h2 style={s.mfaTitle}>One more step</h2>
            <p style={s.mfaBody}>
              Enter the six-digit code from your authenticator app to finish signing in.
            </p>
            <label style={s.label}>Six-digit code</label>
            <input
              style={s.mfaInput}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleMfaVerify()}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              autoFocus
            />

            {error && <div style={s.error}>{error}</div>}

            <button
              onClick={handleMfaVerify}
              disabled={mfaVerifying}
              style={{ ...s.submitBtn, opacity: mfaVerifying ? 0.6 : 1 }}
            >
              {mfaVerifying ? "Verifying…" : "Verify & continue →"}
            </button>

            <button onClick={handleMfaCancel} style={s.mfaCancelBtn} disabled={mfaVerifying}>
              Cancel and sign out
            </button>
          </>
        ) : (
          <>
            <div style={s.toggle}>
              <button onClick={() => { setMode("login"); setError(null); setSuccess(null); }} style={{ ...s.toggleBtn, ...(mode === "login" ? s.toggleActive : {}) }}>Sign In</button>
              <button onClick={() => { setMode("signup"); setError(null); setSuccess(null); }} style={{ ...s.toggleBtn, ...(mode === "signup" ? s.toggleActive : {}) }}>Create Account</button>
            </div>

            <label style={s.label}>Email</label>
            <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder="your@email.com" autoComplete="email" />

            <label style={s.label}>Password</label>
            <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} placeholder={mode === "signup" ? "Choose a password (6+ characters)" : "Your password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} />

            {error   && <div style={s.error}>{error}</div>}
            {success && <div style={s.successMsg}>{success}</div>}

            <button onClick={handleSubmit} disabled={loading} style={{ ...s.submitBtn, opacity: loading ? 0.6 : 1 }}>
              {loading ? "Please wait…" : mode === "login" ? "Sign In →" : "Create Account →"}
            </button>

            {mode === "signup" && (
              <p style={s.consent}>
                By creating an account, you agree to our{" "}
                <Link href="/privacy" style={s.consentLink}>Privacy Policy</Link>.
              </p>
            )}
          </>
        )}

        <p style={s.privacy}>Your projects are private and only visible to you. HAIIC does not sell or share your data.</p>
      </div>
    </div>
  );
}

const s = {
  page:        { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", padding: 24 },
  card:        { background: "#1a1a1a", border: "1px solid #333", borderRadius: 16, padding: 40, width: "100%", maxWidth: 420 },
  header:      { textAlign: "center", marginBottom: 32 },
  logo:        { height: 48, width: "auto", margin: "0 auto 12px", display: "block" },
  attribution: { fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C0392B", marginBottom: 8, marginTop: 4 },
  subtitle:    { fontSize: 14, color: "#888", lineHeight: 1.5 },
  toggle:      { display: "flex", background: "#222", borderRadius: 8, padding: 4, marginBottom: 24, gap: 4 },
  toggleBtn:   { flex: 1, background: "transparent", border: "none", borderRadius: 6, color: "#888", padding: "8px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  toggleActive:{ background: "#C0392B", color: "#fff" },
  label:       { display: "block", fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 6, marginTop: 16 },
  input:       { width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#f0f0f0", padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" },
  error:       { background: "#3d1515", border: "1px solid #7d2020", borderRadius: 7, color: "#ff8080", padding: "10px 14px", fontSize: 13, marginTop: 12, lineHeight: 1.5 },
  successMsg:  { background: "#153d1a", border: "1px solid #2d7a3a", borderRadius: 7, color: "#80ff99", padding: "10px 14px", fontSize: 13, marginTop: 12, lineHeight: 1.5 },
  submitBtn:   { width: "100%", background: "#C0392B", border: "none", borderRadius: 8, color: "#fff", padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 20 },
  consent:     { fontSize: 12, color: "#888", textAlign: "center", marginTop: 12, lineHeight: 1.5 },
  consentLink: { color: "#C0392B", textDecoration: "underline" },
  privacy:     { fontSize: 11, color: "#555", textAlign: "center", marginTop: 16, lineHeight: 1.5 },

  mfaTitle:     { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 8, textAlign: "center" },
  mfaBody:      { fontSize: 14, color: "#aaa", lineHeight: 1.6, marginBottom: 16, textAlign: "center" },
  mfaInput:     { width: "100%", background: "#0a0a0a", border: "1px solid #333", borderRadius: 8, color: "#f0f0f0", padding: "12px 14px", fontSize: 20, fontFamily: "monospace", outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: 4 },
  mfaCancelBtn: { width: "100%", background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 10 },
};
