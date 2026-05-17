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

  const [handle, setHandle] = useState("");
  const [cvPath, setCvPath] = useState(null);
  const [categories, setCategories] = useState(EMPTY_CATEGORIES);

  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [extractionMsg, setExtractionMsg] = useState(null);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaModal, setMfaModal] = useState(null); // null | "enrolling"

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
        setHandle(profile.name || "");
        setCvPath(profile.cv_path || null);
        setCategories({ ...EMPTY_CATEGORIES, ...(profile.profile_categories || {}) });
        setMode("edit");
      } else {
        setMode("create");
      }

      await checkMfaStatus();
    });
  }, []);

  const checkMfaStatus = async () => {
    setMfaLoading(true);
    try {
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const verified = (data?.totp || []).find((f) => f.status === "verified");
      setMfaEnabled(!!verified);
    } catch {
      setMfaEnabled(false);
    } finally {
      setMfaLoading(false);
    }
  };

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
      setExtractionMsg("Got it! Take a look at the sections below — edit anything that needs adjusting. You can delete the CV file itself anytime; we only needed it for the extraction.");
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
    if (!handle.trim()) {
      setError("Please pick a handle — any name you'd like us to call you.");
      return;
    }
    setSaving(true);
    try {
      const { error: upsertErr } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            name: handle.trim(),
            cv_path: cvPath,
            profile_categories: categories,
          },
          { onConflict: "user_id" }
        );
      if (upsertErr) throw upsertErr;

      setJustSaved(true);

      let dest = next;
      if (mode === "create" && next === "/") {
        dest = `/?welcome=true&name=${encodeURIComponent(handle.trim())}`;
      }

      setTimeout(() => router.push(dest), 900);
    } catch (err) {
      setError(err.message || "Couldn't save your profile. Want to try again?");
      setSaving(false);
    }
  };

  const handleCancel = () => router.push(next);

  const handleDisable2FA = async () => {
    if (!confirm("Turn off two-factor authentication? You'll go back to signing in with just your password.")) return;
    try {
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const verified = (data?.totp || []).find((f) => f.status === "verified");
      if (verified) {
        await supabase.auth.mfa.unenroll({ factorId: verified.id });
      }
      setMfaEnabled(false);
    } catch (err) {
      alert("Couldn't turn off two-factor authentication. Please try again. (" + (err.message || "Unknown error") + ")");
    }
  };

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
          <label style={s.label}>Your handle</label>
          <p style={s.helper}>
            What you'd like us to call you across all the HAIIC apps. We recommend a
            nickname or handle rather than your real name — it's not stored anywhere
            visible to other people, but using a handle keeps your work pseudonymous in
            case you'd ever like to share a session, a draft, or a screenshot. Your
            legal name is only needed at the moment you file a patent, and only if you
            want our help merging it into your final document.
          </p>
          <input
            style={s.input}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. trailbuilder, gardenmom1972, El Jefe..."
          />
        </div>

        <div style={s.section}>
          <label style={s.label}>Got a CV or resume?</label>
          <p style={s.helper}>
            Upload it as a PDF and we'll do the heavy lifting — work, education, skills, and hobbies
            will be filled in below. You can delete the CV file itself once the extraction is done;
            we only need it briefly.
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
              <button onClick={handleRemoveCv} style={s.linkBtn}>Delete file</button>
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

        <div style={s.securitySection}>
          <h2 style={s.securityHeading}>Account security</h2>
          <p style={s.securityIntro}>
            Two-factor authentication keeps your account safe even if someone gets your password.
            It takes thirty seconds to set up — we recommend it.
          </p>

          {mfaLoading ? (
            <p style={s.helper}>Checking…</p>
          ) : mfaEnabled ? (
            <div style={s.mfaEnabledRow}>
              <span style={s.mfaCheck}>✓</span>
              <span style={s.mfaEnabledText}>Two-factor authentication is on.</span>
              <button onClick={handleDisable2FA} style={s.linkBtn}>Turn off</button>
            </div>
          ) : (
            <button onClick={() => setMfaModal("enrolling")} style={s.enrollBtn}>
              Turn on two-factor authentication →
            </button>
          )}
        </div>

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
          Your profile is private and only visible to you. HAIIC does not sell your data
          or share it with anyone else.
        </p>
      </div>

      {mfaModal === "enrolling" && (
        <EnrollMfaModal
          onClose={() => setMfaModal(null)}
          onComplete={() => {
            setMfaModal(null);
            setMfaEnabled(true);
          }}
        />
      )}
    </div>
  );
}

function EnrollMfaModal({ onClose, onComplete }) {
  const [step, setStep] = useState("loading"); // loading | scan | error
  const [factorId, setFactorId] = useState(null);
  const [qrSvg, setQrSvg] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errMsg, setErrMsg] = useState(null);

  useEffect(() => {
    let mounted = true;
    let createdFactorId = null;

    const start = async () => {
      try {
        // Clean up any leftover unverified factors from prior aborted attempts
        const { data: existing } = await supabase.auth.mfa.listFactors();
        const unverified = (existing?.totp || []).filter((f) => f.status === "unverified");
        for (const f of unverified) {
          try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch {}
        }

        const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
        if (error) throw error;
        if (!mounted) return;
        createdFactorId = data.id;
        setFactorId(data.id);
        setQrSvg(data.totp?.qr_code || null);
        setSecret(data.totp?.secret || null);
        setStep("scan");
      } catch (err) {
        if (!mounted) return;
        setErrMsg(err.message || "Couldn't start setup. Please try again.");
        setStep("error");
      }
    };
    start();

    // If user closes modal mid-flow without verifying, clean up the unverified factor
    return () => {
      mounted = false;
      if (createdFactorId) {
        supabase.auth.mfa.listFactors().then(({ data }) => {
          const f = (data?.totp || []).find((x) => x.id === createdFactorId && x.status === "unverified");
          if (f) {
            supabase.auth.mfa.unenroll({ factorId: createdFactorId }).catch(() => {});
          }
        });
      }
    };
  }, []);

  const handleVerify = async () => {
    setErrMsg(null);
    const trimmed = code.trim();
    if (trimmed.length !== 6 || !/^\d+$/.test(trimmed)) {
      setErrMsg("The code is six digits. Take a look at your authenticator app.");
      return;
    }
    setVerifying(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: trimmed,
      });
      if (vErr) throw vErr;
      onComplete();
    } catch (err) {
      setErrMsg(err.message || "That code didn't match. The codes change every 30 seconds — try the newest one.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={m.backdrop} onClick={onClose}>
      <div style={m.modal} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={m.closeX} aria-label="Close">×</button>

        {step === "loading" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={m.loadingText}>Setting up two-factor authentication…</p>
          </div>
        )}

        {step === "error" && (
          <div>
            <h2 style={m.title}>Something went wrong</h2>
            <p style={m.body}>{errMsg}</p>
            <button onClick={onClose} style={m.cancelBtn}>Close</button>
          </div>
        )}

        {step === "scan" && (
          <div>
            <h2 style={m.title}>Set up two-factor authentication</h2>
            <p style={m.body}>
              You'll need an authenticator app on your phone. If you don't have one, free options include
              Google Authenticator, 1Password, Authy, and Microsoft Authenticator. Any of them works.
            </p>

            <ol style={m.steps}>
              <li style={m.step}>Open your authenticator app and add a new account.</li>
              <li style={m.step}>Scan the QR code below with your phone's camera (or your app's scanner).</li>
              <li style={m.step}>Type the six-digit code your app shows you, then click Verify.</li>
            </ol>

            {qrSvg && (
              <div style={m.qrWrap} dangerouslySetInnerHTML={{ __html: qrSvg }} />
            )}

            {secret && (
              <details style={m.manualWrap}>
                <summary style={m.manualToggle}>Can't scan? Use this code instead</summary>
                <p style={m.manualHelp}>
                  In your authenticator app, choose "Enter a setup key" or "Manual entry" and paste this:
                </p>
                <code style={m.secretCode}>{secret}</code>
              </details>
            )}

            <label style={m.codeLabel}>Six-digit code from your app</label>
            <input
              style={m.codeInput}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              autoFocus
            />

            {errMsg && <div style={m.errorBox}>{errMsg}</div>}

            <p style={m.warning}>
              <strong>Important:</strong> keep your authenticator app accessible. If you lose access to it
              and we can't verify it's really you, we may not be able to restore your account.
            </p>

            <div style={m.actions}>
              <button onClick={onClose} style={m.cancelBtn} disabled={verifying}>
                Cancel
              </button>
              <button
                onClick={handleVerify}
                style={{ ...m.verifyBtn, opacity: verifying ? 0.6 : 1 }}
                disabled={verifying}
              >
                {verifying ? "Verifying…" : "Verify & turn on"}
              </button>
            </div>
          </div>
        )}
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

  securitySection:  { marginTop: 32, marginBottom: 24, paddingTop: 24, borderTop: "1px solid #333" },
  securityHeading:  { fontSize: 16, fontWeight: 700, color: "#f0f0f0", marginBottom: 8 },
  securityIntro:    { fontSize: 13, color: "#aaa", lineHeight: 1.6, marginBottom: 14 },
  enrollBtn:        { background: "transparent", border: "1px solid #C0392B", borderRadius: 8, color: "#C0392B", padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  mfaEnabledRow:    { background: "#1a1a1a", border: "1px solid #2d7a3a", borderRadius: 8, padding: "12px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 10, color: "#ddd" },
  mfaCheck:         { color: "#80ff99", fontSize: 16, fontWeight: 700 },
  mfaEnabledText:   { flex: 1 },

  stickyBar:   { position: "sticky", bottom: 0, background: "#1a1a1a", borderTop: "1px solid #333", marginTop: 24, paddingTop: 16, paddingBottom: 16, zIndex: 10 },
  barStatus:   { textAlign: "center", marginBottom: 12 },
  barSuccess:  { color: "#80ff99", fontSize: 13, fontWeight: 600 },
  barError:    { color: "#ff8080", fontSize: 13 },
  barButtons:  { display: "flex", gap: 10 },

  submitBtn:   { background: "#C0392B", border: "none", borderRadius: 8, color: "#fff", padding: "13px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  cancelBtn:   { background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", padding: "13px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  privacy:     { fontSize: 11, color: "#555", textAlign: "center", marginTop: 20, lineHeight: 1.5 },
};

const m = {
  backdrop:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 100 },
  modal:        { background: "#1a1a1a", border: "1px solid #333", borderRadius: 16, padding: 32, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", position: "relative" },
  closeX:       { position: "absolute", top: 12, right: 16, background: "transparent", border: "none", color: "#888", fontSize: 24, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", lineHeight: 1 },
  loadingText:  { color: "#888", fontSize: 14, fontFamily: "'DM Sans', sans-serif" },
  title:        { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 12 },
  body:         { fontSize: 14, color: "#aaa", lineHeight: 1.6, marginBottom: 16 },
  steps:        { paddingLeft: 20, marginBottom: 20 },
  step:         { fontSize: 13, color: "#aaa", lineHeight: 1.6, marginBottom: 6 },
  qrWrap:       { background: "#fff", padding: 16, borderRadius: 8, margin: "0 auto 20px", maxWidth: 220, textAlign: "center" },
  manualWrap:   { marginBottom: 20 },
  manualToggle: { fontSize: 12, color: "#C0392B", cursor: "pointer", fontWeight: 600 },
  manualHelp:   { fontSize: 12, color: "#888", lineHeight: 1.6, marginTop: 8, marginBottom: 6 },
  secretCode:   { display: "block", background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#f0f0f0", fontFamily: "monospace", wordBreak: "break-all", marginBottom: 8 },
  codeLabel:    { display: "block", fontSize: 13, fontWeight: 600, color: "#ddd", marginBottom: 6 },
  codeInput:    { width: "100%", background: "#0a0a0a", border: "1px solid #333", borderRadius: 8, color: "#f0f0f0", padding: "12px 14px", fontSize: 20, fontFamily: "monospace", outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: 4 },
  errorBox:     { background: "#3d1515", border: "1px solid #7d2020", borderRadius: 7, color: "#ff8080", padding: "10px 14px", fontSize: 13, marginTop: 12, lineHeight: 1.5 },
  warning:      { fontSize: 12, color: "#d4b87a", lineHeight: 1.5, marginTop: 16, padding: "10px 12px", background: "#2a2419", border: "1px solid #4a4019", borderRadius: 7 },
  actions:      { display: "flex", gap: 10, marginTop: 20 },
  cancelBtn:    { background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  verifyBtn:    { flex: 1, background: "#C0392B", border: "none", borderRadius: 8, color: "#fff", padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};
