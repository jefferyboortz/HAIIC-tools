import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://quruzppflgdbddxyylxu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnV6cHBmbGdkYmRkeHl5bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDQ1NTEsImV4cCI6MjA4OTE4MDU1MX0.y6acgCo6EZZiEDIJHSx6J3T60L1P6M_DH3vTIulFvJ0"
);

const MAX_CV_SIZE_MB = 5;
const MAX_CV_SIZE_BYTES = MAX_CV_SIZE_MB * 1024 * 1024;

const EMPTY_CATEGORIES = {
  work: "",
  education: "",
  skills: "",
  hobbies: "",
  passions: "",
  lived_experience: "",
  values_worldview: "",
};

const CATEGORY_META = [
  { key: "work",             label: "Work experience",   helper: "Jobs, roles, what you've done. Past and present." },
  { key: "education",        label: "Education",         helper: "Schools, degrees, training. Formal or otherwise." },
  { key: "skills",           label: "Skills",            helper: "Things you can do well. Technical or not." },
  { key: "hobbies",          label: "Hobbies",           helper: "What you do for fun." },
  { key: "passions",         label: "Passions",          helper: "What you care about — causes, interests, things that drive you." },
  { key: "lived_experience", label: "Lived experience",  helper: "Life context that shapes how you see things. Parenting, caregiving, illness, travel, where you grew up — anything." },
  { key: "values_worldview", label: "Values & worldview", helper: "How you see the world. Religious, political, cultural, philosophical — whatever frames how you think." },
];

const PLACEHOLDERS = {
  work:             "e.g. Senior nurse practitioner at Emory (2018-present). Previously...",
  education:        "e.g. BSN from University of Michigan (2010), MSN from Emory (2015).",
  skills:           "e.g. Emergency medicine, EHR systems, woodworking, conversational Spanish.",
  hobbies:          "e.g. Beekeeping, hiking with my dog, restoring old furniture.",
  passions:         "e.g. Healthcare access for rural communities. Adaptive technology.",
  lived_experience: "e.g. Caregiver for my mother in her last years. Grew up on a farm.",
  values_worldview: "e.g. Quaker. Believer in cooperative ownership. Pragmatist.",
};

export default function ProfilePage() {
  const router = useRouter();
  const next   = router.query.next   || "/";
  const reason = router.query.reason || null;

  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [cvPath, setCvPath] = useState(null);
  const [categories, setCategories] = useState(EMPTY_CATEGORIES);

  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [extractionMsg, setExtractionMsg] = useState(null);

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
        .select("name, cv_path, profile_categories")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profile) {
        setName(profile.name || "");
        setCvPath(profile.cv_path || null);
        setCategories({ ...EMPTY_CATEGORIES, ...(profile.profile_categories || {}) });
        setMode("edit");
      } else {
        setMode("create");
      }
    });
  }, []);

  const handleFilePick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    setExtractionMsg(null);

    if (file.type !== "application/pdf") {
      setUploadError("Please upload a PDF. If your CV is in Word, use File → Export → PDF first.");
      return;
    }
    if (file.size > MAX_CV_SIZE_BYTES) {
      setUploadError(`That file is too large. CVs under ${MAX_CV_SIZE_MB}MB work best.`);
      return;
    }

    setUploading(true);
    try {
      const path = `${user.id}/cv.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from("cvs")
        .upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (uploadErr) throw uploadErr;
      setCvPath(path);
      setUploading(false);

      setExtracting(true);
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/extract-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: "application/pdf" }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Couldn't read your CV.");
      }

      const { categories: extracted } = await res.json();
      setCategories((prev) => {
        const merged = { ...prev };
        for (const key of Object.keys(extracted)) {
          if (extracted[key] && extracted[key].trim()) {
            merged[key] = extracted[key];
          }
        }
        return merged;
      });
      setExtractionMsg("Got it! Take a look at the sections below — edit anything that needs adjusting.");
    } catch (err) {
      setUploadError(err.message || "Couldn't read your CV — but no worries, you can fill in the sections below yourself.");
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  const handleRemoveCv = async () => {
    if (!confirm("Remove your uploaded CV? The sections below will stay as they are.")) return;
    try {
      await supabase.storage.from("cvs").remove([`${user.id}/cv.pdf`]);
    } catch {}
    setCvPath(null);
    setExtractionMsg(null);
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Please share your name — even just a first name is fine.");
      return;
    }
    setSaving(true);
    try {
      const { error: upsertErr } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            name: name.trim(),
            cv_path: cvPath,
            profile_categories: categories,
          },
          { onConflict: "user_id" }
        );
      if (upsertErr) throw upsertErr;

      setJustSaved(true);

      let dest = next;
      if (mode === "create" && next === "/") {
        dest = `/?welcome=true&name=${encodeURIComponent(name.trim())}`;
      }

      setTimeout(() => router.push(dest), 900);
    } catch (err) {
      setError(err.message || "Couldn't save your profile. Want to try again?");
      setSaving(false);
    }
  };

  const handleCancel = () => router.push(next);

  if (mode === "loading") {
    return (
      <div style={s.page}>
        <div style={{ ...s.card, textAlign: "center" }}>
          <p style={s.loadingText}>Loading your profile…</p>
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
    subhead  = "A bit of context so we can help you draw on what you already know. This stays with you across all the HAIIC apps.";
  } else {
    headline = "Your profile";
    subhead  = "Update your background anytime. Changes apply to new projects going forward — existing projects keep the context they had when you started them.";
  }

  const submitLabel = mode === "edit" ? "Save Changes →" : "Save & Continue →";
  const totalChars = Object.values(categories).reduce((sum, v) => sum + (v || "").length, 0);

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <p style={s.attribution}>Human-AI Innovation Commons</p>
          <h1 style={s.headline}>{headline}</h1>
          <p style={s.subhead}>{subhead}</p>
          {user?.email && <p style={s.signedInAs}>Signed in as {user.email}</p>}
        </div>

        <div style={s.section}>
          <label style={s.label}>Your name</label>
          <input
            style={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call you?"
          />
        </div>

        <div style={s.section}>
          <label style={s.label}>Got a CV or resume?</label>
          <p style={s.helper}>
            Upload it as a PDF and we'll do the heavy lifting — work, education, skills, and hobbies
            will be filled in below. You can edit anything afterward.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            accept="application/pdf"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {!cvPath && !uploading && !extracting && (
            <button onClick={handleFilePick} style={s.uploadBtn}>📄 Choose a PDF</button>
          )}

          {(uploading || extracting) && (
            <div style={s.statusBox}>
              <span style={s.spinner}>◌</span>
              {uploading && "Uploading your CV…"}
              {extracting && "Reading your CV — this can take 10-20 seconds…"}
            </div>
          )}

          {cvPath && !uploading && !extracting && (
            <div style={s.cvStatus}>
              <span style={s.cvCheck}>✓</span>
              <span style={s.cvText}>CV uploaded</span>
              <button onClick={handleFilePick} style={s.linkBtn}>Replace</button>
              <button onClick={handleRemoveCv} style={s.linkBtn}>Remove</button>
            </div>
          )}

          {uploadError && <div style={s.errorBox}>{uploadError}</div>}
          {extractionMsg && <div style={s.successBox}>{extractionMsg}</div>}

          <p style={s.orDivider}>— or just dive into the sections below —</p>
        </div>

        {CATEGORY_META.map(({ key, label, helper }) => (
          <div key={key} style={s.section}>
            <label style={s.label}>{label}</label>
            <p style={s.helper}>{helper}</p>
            <textarea
              style={s.textarea}
              value={categories[key]}
              onChange={(e) => setCategories({ ...categories, [key]: e.target.value })}
              placeholder={PLACEHOLDERS[key]}
              rows={3}
            />
          </div>
        ))}

        {totalChars === 0 && !justSaved && (
          <p style={s.softNudge}>
            All your background sections are empty. You can save now, but the more we know,
            the better we can help you in Brainstorm and the other apps.
          </p>
        )}

        <div style={s.stickyBar}>
          {(justSaved || error) && (
            <div style={s.barStatus}>
              {justSaved && <span style={s.barSuccess}>✓ Saved! Taking you home…</span>}
              {error && !justSaved && <span style={s.barError}>{error}</span>}
            </div>
          )}
          <div style={s.barButtons}>
            {mode === "edit" && (
              <button onClick={handleCancel} style={s.cancelBtn} disabled={saving || justSaved}>
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || justSaved}
              style={{
                ...s.submitBtn,
                opacity: (saving || justSaved) ? 0.6 : 1,
                flex: mode === "edit" ? 1 : "unset",
                width: mode === "edit" ? "auto" : "100%",
              }}
            >
              {justSaved ? "Saved ✓" : saving ? "Saving…" : submitLabel}
            </button>
          </div>
        </div>

        <p style={s.privacy}>
          Your profile is private and only visible to you. HAIIC does not sell or share your data.
        </p>
      </div>
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === "string" ? result.split(",")[1] : "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

const s = {
  page:        { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", padding: 24 },
  card:        { background: "#1a1a1a", border: "1px solid #333", borderRadius: 16, padding: 40, width: "100%", maxWidth: 640 },
  header:      { marginBottom: 28 },
  attribution: { fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#C0392B", marginBottom: 12, textAlign: "center" },
  headline:    { fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#f0f0f0", marginBottom: 12, textAlign: "center", lineHeight: 1.2 },
  subhead:     { fontSize: 14, color: "#aaa", lineHeight: 1.6, textAlign: "center", marginBottom: 16 },
  signedInAs:  { fontSize: 12, color: "#666", textAlign: "center", marginTop: 8 },
  loadingText: { color: "#888", fontSize: 14, fontFamily: "'DM Sans', sans-serif" },

  section:     { marginBottom: 24 },
  label:       { display: "block", fontSize: 13, fontWeight: 600, color: "#ddd", marginBottom: 6 },
  helper:      { fontSize: 12, color: "#888", lineHeight: 1.5, marginBottom: 10, marginTop: 0 },
  input:       { width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#f0f0f0", padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" },
  textarea:    { width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#f0f0f0", padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 },

  uploadBtn:   { background: "transparent", border: "1px dashed #555", borderRadius: 8, color: "#ddd", padding: "14px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", width: "100%" },
  statusBox:   { background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#aaa", padding: "12px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 10 },
  spinner:     { display: "inline-block", fontSize: 16, color: "#C0392B" },
  cvStatus:    { background: "#1a1a1a", border: "1px solid #2d7a3a", borderRadius: 8, padding: "12px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 10, color: "#ddd" },
  cvCheck:     { color: "#80ff99", fontSize: 16, fontWeight: 700 },
  cvText:      { flex: 1 },
  linkBtn:     { background: "transparent", border: "none", color: "#C0392B", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "4px 8px" },

  orDivider:   { fontSize: 12, color: "#666", textAlign: "center", marginTop: 16, marginBottom: 0, fontStyle: "italic" },

  errorBox:    { background: "#3d1515", border: "1px solid #7d2020", borderRadius: 7, color: "#ff8080", padding: "10px 14px", fontSize: 13, marginTop: 12, lineHeight: 1.5 },
  successBox:  { background: "#153d1a", border: "1px solid #2d7a3a", borderRadius: 7, color: "#80ff99", padding: "10px 14px", fontSize: 13, marginTop: 12, lineHeight: 1.5 },
  softNudge:   { background: "#2a2419", border: "1px solid #4a4019", borderRadius: 7, color: "#d4b87a", padding: "10px 14px", fontSize: 12, marginTop: 12, lineHeight: 1.5 },

  stickyBar:   { position: "sticky", bottom: 0, background: "#1a1a1a", borderTop: "1px solid #333", marginTop: 24, paddingTop: 16, paddingBottom: 16, zIndex: 10 },
  barStatus:   { textAlign: "center", marginBottom: 12 },
  barSuccess:  { color: "#80ff99", fontSize: 13, fontWeight: 600 },
  barError:    { color: "#ff8080", fontSize: 13 },
  barButtons:  { display: "flex", gap: 10 },

  submitBtn:   { background: "#C0392B", border: "none", borderRadius: 8, color: "#fff", padding: "13px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  cancelBtn:   { background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", padding: "13px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  privacy:     { fontSize: 11, color: "#555", textAlign: "center", marginTop: 20, lineHeight: 1.5 },
};
