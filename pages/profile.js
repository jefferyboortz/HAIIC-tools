import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import theme from "../components/theme";

const supabase = createClient(
  "https://quruzppflgdbddxyylxu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnV6cHBmbGdkYmRkeHl5bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDQ1NTEsImV4cCI6MjA4OTE4MDU1MX0.y6acgCo6EZZiEDIJHSx6J3T60L1P6M_DH3vTIulFvJ0"
);

const PLACEHOLDER_BG = `e.g. "30 years as an ER nurse, beekeeper on weekends"
or "Stay-at-home parent, used to work in software, woodworker"
or "Retired teacher, lifelong tinkerer, love fixing things"`;

export default function ProfilePage() {
  const router = useRouter();
  const next   = router.query.next   || "/";
  const reason = router.query.reason || null;

  const [user,       setUser]       = useState(null);
  const [name,       setName]       = useState("");
  const [background, setBackground] = useState("");
  const [mode,       setMode]       = useState("loading");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        const params = router.asPath.includes("?") ? router.asPath.slice(router.asPath.indexOf("?")) : "";
        router.push(`/login?next=${encodeURIComponent("/profile" + params)}`);
        return;
      }
      setUser(session.user);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name, background")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profile) {
        setName(profile.name || "");
        setBackground(profile.background || "");
        setMode("edit");
      } else {
        setMode("create");
      }
    });
  }, []);

  const handleSave = async () => {
    setError(null);
    if (!name.trim())       { setError("Please share your name — even just a first name is fine."); return; }
    if (!background.trim()) { setError("Tell us a little about your background — anything that shapes how you see the world."); return; }

    setSaving(true);
    try {
      const { error: upsertError } = await supabase
        .from("user_profiles")
        .upsert(
          { user_id: user.id, name: name.trim(), background: background.trim() },
          { onConflict: "user_id" }
        );
      if (upsertError) throw upsertError;
      router.push(next);
    } catch (err) {
      setError(err.message || "Couldn't save your profile. Want to try again?");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => router.push(next);

  if (mode === "loading") {
    return (
      <div style={s.page}>
        <div style={{ ...s.card, textAlign: "center" }}>
          <p style={{ color: "#888", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading your profile…</p>
        </div>
      </div>
    );
  }

  let headline, subhead;
  if (mode === "create" && reason === "missing") {
    headline = "Let's rebuild your profile";
    subhead  = "I'm anxious to get started, but I'm unable to find your profile. Let's rebuild it. It will only take a minute and will be so worth it.";
  } else if (mode === "create" && reason === "signup") {
    headline = "Welcome to HAIIC";
    subhead  = "Before we dig in, help us understand where you're coming from. This stays with you across all the HAIIC apps — you'll only do this once.";
  } else if (mode === "create") {
    headline = "Let's set up your profile";
    subhead  = "A quick bit of context so we can help you draw on what you already know. This stays with you across all the HAIIC apps.";
  } else {
    headline = "Your Profile";
    subhead  = "Update your background anytime. Changes apply to new projects going forward — existing projects keep the context they had when you started them.";
  }

  const submitLabel = mode === "edit" ? "Save Changes →" : "Save & Continue →";

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <p style={s.attribution}>Human-AI Innovation Commons</p>
          <h1 style={s.headline}>{headline}</h1>
          <p style={s.subhead}>{subhead}</p>
          {user?.email && <p style={s.signedInAs}>Signed in as {user.email}</p>}
        </div>

        <label style={s.label}>Your name</label>
        <input
          style={s.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
        />

        <label style={s.label}>Your background</label>
        <p style={s.helper}>
          Work, hobbies, life experience — anything that shapes how you see the world.
          The more we know, the better we can help you draw on what you already know.
        </p>
        <textarea
          style={s.textarea}
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          placeholder={PLACEHOLDER_BG}
          rows={6}
        />

        {error && <div style={s.error}>{error}</div>}

        <div style={s.actions}>
          {mode === "edit" && (
            <button onClick={handleCancel} style={s.cancelBtn} disabled={saving}>
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...s.submitBtn, opacity: saving ? 0.6 : 1, flex: mode === "edit" ? 1 : "unset", width: mode === "edit" ? "auto" : "100%" }}
          >
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>

        <p style={s.privacy}>
          Your profile is private and only visible to you. HAIIC does not sell or share your data.
        </p>
      </div>
    </div>
  );
}

const s = {
  page:        { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", padding: 24 },
  card:        { background: "#1a1a1a", border: "1px solid #333", borderRadius: 16, padding: 40, width: "100%", maxWidth: 540 },
  header:      { marginBottom: 28 },
  attribution: { fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C0392B", marginBottom: 12, textAlign: "center" },
  headline:    { fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 12, textAlign: "center", lineHeight: 1.2 },
  subhead:     { fontSize: 14, color: "#aaa", lineHeight: 1.6, textAlign: "center", marginBottom: 16 },
  signedInAs:  { fontSize: 12, color: "#666", textAlign: "center", marginTop: 8 },
  label:       { display: "block", fontSize: 13, fontWeight: 600, color: "#aaa", marginBottom: 6, marginTop: 16 },
  helper:      { fontSize: 12, color: "#777", lineHeight: 1.5, marginBottom: 8, marginTop: 0 },
  input:       { width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#f0f0f0", padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" },
  textarea:    { width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#f0f0f0", padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 },
  error:       { background: "#3d1515", border: "1px solid #7d2020", borderRadius: 7, color: "#ff8080", padding: "10px 14px", fontSize: 13, marginTop: 16, lineHeight: 1.5 },
  actions:     { display: "flex", gap: 10, marginTop: 24 },
  submitBtn:   { background: "#C0392B", border: "none", borderRadius: 8, color: "#fff", padding: "13px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  cancelBtn:   { background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", padding: "13px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  privacy:     { fontSize: 11, color: "#555", textAlign: "center", marginTop: 20, lineHeight: 1.5 },
};
