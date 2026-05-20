import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import theme from "./theme";

const BUCKET = "bug-report-screenshots";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export default function ReportProblemModal({ open, onClose }) {
  const router = useRouter();
  const [tryingToDo, setTryingToDo]     = useState("");
  const [whatWentWrong, setWWW]         = useState("");
  const [screenshot, setScreenshot]     = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [error, setError]               = useState("");
  const [supportsCapture, setSupports]  = useState(false);
  const fileInputRef                    = useRef(null);
  const dropZoneRef                     = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined" && navigator?.mediaDevices?.getDisplayMedia) {
      setSupports(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            handleFileSelected(file);
            e.preventDefault();
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setTryingToDo("");
      setWWW("");
      setScreenshot(null);
      setSubmitted(false);
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  const handleFileSelected = (file) => {
    if (!file || !file.type?.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Screenshot must be under 10MB.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshot({
        file,
        previewUrl: reader.result,
        name: file.name || "screenshot.png",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = "";
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleScreenCapture = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      await new Promise(resolve => setTimeout(resolve, 200));

      const video = document.createElement("video");
      video.srcObject = stream;
      await new Promise(resolve => { video.onloadedmetadata = resolve; });
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      track.stop();
      stream.getTracks().forEach(t => t.stop());

      canvas.toBlob((blob) => {
        if (!blob) {
          setError("Couldn't capture the screenshot. Try again or paste an image.");
          return;
        }
        const file = new File([blob], `capture-${Date.now()}.png`, { type: "image/png" });
        handleFileSelected(file);
      }, "image/png");
    } catch (err) {
      if (err.name === "NotAllowedError") {
        return;
      }
      console.error("Screen capture failed:", err);
      setError("Screen capture failed. Try pasting a screenshot instead.");
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setError("");
  };

  const handleSubmit = async () => {
    if (!whatWentWrong.trim()) {
      setError("Please describe what went wrong before submitting.");
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("You must be signed in to report a problem.");

      let storagePath = null;
      if (screenshot?.file) {
        const ext = screenshot.file.name.split(".").pop() || "png";
        const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        storagePath = `${user.id}/${genId()}.${safeExt}`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, screenshot.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: screenshot.file.type || "image/png",
          });
        if (uploadErr) {
          console.error("Screenshot upload failed:", uploadErr);
          storagePath = null;
        }
      }

      const payload = {
        user_id: user.id,
        email: user.email || null,
        current_page: typeof window !== "undefined" ? router.asPath : null,
        user_agent: typeof window !== "undefined" ? navigator.userAgent : null,
        trying_to_do: tryingToDo.trim() || null,
        what_went_wrong: whatWentWrong.trim(),
        screenshot_storage_path: storagePath,
      };

      const res = await fetch("/api/submit-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Submission failed.");
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Report submission failed:", err);
      setError(err.message || "Couldn't submit your report — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        {submitted ? (
          <>
            <h2 style={s.title}>Thanks — we got it.</h2>
            <p style={s.body}>
              Your report is in. We'll take a look as soon as we can.
              The more reports we get during testing, the better the platform gets — so thank you for taking the time.
            </p>
            <div style={s.actions}>
              <button onClick={onClose} style={s.primaryBtn}>Close</button>
            </div>
          </>
        ) : (
          <>
            <div style={s.header}>
              <h2 style={s.title}>Report a Problem</h2>
              <button onClick={onClose} style={s.closeBtn} aria-label="Close">✕</button>
            </div>

            <p style={s.intro}>
              Found a bug or something confusing? Tell us about it.
              Screenshots help a lot — paste, drag, or capture below.
            </p>

            <label style={s.label}>What were you trying to do?</label>
            <textarea
              style={s.textarea}
              value={tryingToDo}
              onChange={e => setTryingToDo(e.target.value)}
              placeholder="Optional — e.g., 'Generate a Filing Draft from my Brainstorm project'"
              rows={2}
              disabled={submitting}
            />

            <label style={s.label}>What went wrong? <span style={s.required}>*</span></label>
            <textarea
              style={s.textarea}
              value={whatWentWrong}
              onChange={e => setWWW(e.target.value)}
              placeholder="Required — describe what happened, what you expected, anything unusual"
              rows={4}
              disabled={submitting}
            />

            <label style={s.label}>Screenshot (optional but very helpful)</label>

            {!screenshot ? (
              <div
                ref={dropZoneRef}
                style={s.dropZone}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <p style={s.dropZoneText}>
                  Paste a screenshot here (⌘V), drag and drop an image, or:
                </p>
                <div style={s.dropZoneButtons}>
                  {supportsCapture && (
                    <button
                      onClick={handleScreenCapture}
                      style={s.captureBtn}
                      disabled={submitting}
                      type="button"
                    >
                      📸 Capture Screenshot
                    </button>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={s.uploadBtn}
                    disabled={submitting}
                    type="button"
                  >
                    📁 Choose File
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  style={{ display: "none" }}
                />
              </div>
            ) : (
              <div style={s.previewWrap}>
                <img src={screenshot.previewUrl} alt="Screenshot preview" style={s.preview} />
                <div style={s.previewMeta}>
                  <span style={s.previewName}>{screenshot.name}</span>
                  <button onClick={removeScreenshot} style={s.removeBtn} disabled={submitting} type="button">
                    Remove
                  </button>
                </div>
              </div>
            )}

            {error && <p style={s.error}>{error}</p>}

            <div style={s.actions}>
              <button onClick={onClose} style={s.cancelBtn} disabled={submitting} type="button">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !whatWentWrong.trim()}
                style={{
                  ...s.primaryBtn,
                  opacity: (submitting || !whatWentWrong.trim()) ? 0.5 : 1,
                  cursor: (submitting || !whatWentWrong.trim()) ? "not-allowed" : "pointer",
                }}
                type="button"
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  backdrop: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.75)", display: "flex",
    alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  modal: {
    background: "#1a1a1a", border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 28, maxWidth: 560, width: "100%",
    maxHeight: "calc(100vh - 40px)", overflowY: "auto",
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  },
  header: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  title: {
    fontFamily: "'Playfair Display', serif", fontSize: 22,
    fontWeight: 700, color: theme.text, margin: 0,
  },
  closeBtn: {
    background: "transparent", border: "none", color: theme.textMuted,
    fontSize: 18, cursor: "pointer", padding: "4px 8px",
    borderRadius: 6, fontFamily: "'DM Sans', sans-serif",
  },
  intro: {
    fontSize: 13, color: theme.textMuted, lineHeight: 1.6,
    marginBottom: 20, marginTop: 0,
  },
  label: {
    display: "block", fontSize: 11, fontWeight: 700,
    letterSpacing: 1.5, color: theme.textDim,
    marginTop: 16, marginBottom: 6, textTransform: "uppercase",
  },
  required: { color: theme.red },
  textarea: {
    width: "100%", background: theme.surface,
    border: `1px solid ${theme.border}`, borderRadius: 8,
    color: theme.text, padding: "10px 14px", fontSize: 13,
    fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
    resize: "vertical", outline: "none", lineHeight: 1.5,
  },
  dropZone: {
    background: theme.surface, border: `2px dashed ${theme.border}`,
    borderRadius: 10, padding: 24, textAlign: "center",
  },
  dropZoneText: {
    fontSize: 13, color: theme.textMuted, lineHeight: 1.6,
    marginBottom: 14, marginTop: 0,
  },
  dropZoneButtons: {
    display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap",
  },
  captureBtn: {
    background: theme.red, border: "none", borderRadius: 7,
    color: "#fff", padding: "9px 16px", fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  uploadBtn: {
    background: "transparent", border: `1px solid ${theme.border}`,
    borderRadius: 7, color: theme.textMuted, padding: "9px 16px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  previewWrap: {
    background: theme.surface, border: `1px solid ${theme.border}`,
    borderRadius: 10, padding: 12,
  },
  preview: {
    width: "100%", maxHeight: 280, objectFit: "contain",
    borderRadius: 6, display: "block", marginBottom: 10,
  },
  previewMeta: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
  },
  previewName: {
    fontSize: 12, color: theme.textMuted, fontFamily: "'DM Sans', sans-serif",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  removeBtn: {
    background: "transparent", border: `1px solid ${theme.border}`,
    borderRadius: 6, color: theme.textDim, padding: "5px 10px",
    fontSize: 11, fontWeight: 600, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  error: {
    fontSize: 12, color: theme.red, marginTop: 12, marginBottom: 0,
    lineHeight: 1.5,
  },
  body: {
    fontSize: 14, color: theme.textMuted, lineHeight: 1.7,
    marginTop: 8, marginBottom: 20,
  },
  actions: {
    display: "flex", gap: 10, justifyContent: "flex-end",
    marginTop: 20, flexWrap: "wrap",
  },
  cancelBtn: {
    background: "transparent", border: `1px solid ${theme.border}`,
    borderRadius: 7, color: theme.textMuted, padding: "9px 16px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  primaryBtn: {
    background: theme.red, border: "none", borderRadius: 7,
    color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif",
  },
};
