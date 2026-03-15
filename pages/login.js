import { useState } from "react";
import { useRouter } from "next/router";
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
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        router.push(router.query.next || "/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.push(router.query.next || "/");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <img src={logoSrc} alt={toolName} style={s.logo} />
          <p style={s.attribution}>A Human-AI Innovation Commons Tool</p>
          <p style={s.subtitle}>Your invention sessions, saved securely across any device.</p>
        </div>

        <div style={s.toggle}>
          <button onClick={() => { setMode("login"); setError(null); }} style={{ ...s.toggleBtn, ...(mode === "login" ? s.toggleActive : {}) }}>Sign In</button>
          <button onClick={() => { setMode("signup"); setError(null); }} style={{ ...s.toggleBtn, ...(mode === "signup" ? s.toggleActive : {}) }}>Create Account</button>
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
  successMsg:  { background: "#153d1a", border: "1px solid #2d7a3a", borderRadius: 7, color: "#80ff99", padding: "10px 14px", fontSize: 13, marginTop: 12 },
  submitBtn:   { width: "100%", background: "#C0392B", border: "none", borderRadius: 8, color: "#fff", padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 20 },
  privacy:     { fontSize: 11, color: "#555", textAlign: "center", marginTop: 16, lineHeight: 1.5 },
};
