import { useState, useRef, useEffect } from "react";
import theme from "./theme";

export default function ChatThread({
  messages,
  loading,
  onSend,
  placeholder,
  emptyState,
  inlineActions,
  disabled,
  hideInput,
  onUploadImage,
  uploadEnabled,
}) {
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, inlineActions]);

  const handleSend = () => {
    if (disabled || hideInput) return;
    if (uploading) return;
    if (!input.trim() && !pendingImage) return;
    if (loading) return;

    onSend(input.trim(), pendingImage);

    setInput("");
    setPendingImage(null);
    setUploadError(null);
  };

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be under 10 MB.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const result = await onUploadImage(file);
      if (!result || !result.storagePath || !result.displayUrl) {
        throw new Error("Upload returned no result");
      }
      setPendingImage({
        type: "image",
        storagePath: result.storagePath,
        displayUrl: result.displayUrl,
        filename: file.name,
      });
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const removePendingImage = () => {
    setPendingImage(null);
    setUploadError(null);
  };

  const actionsByIdx = {};
  if (Array.isArray(inlineActions)) {
    for (const action of inlineActions) {
      if (typeof action?.afterMessageIdx === "number") {
        actionsByIdx[action.afterMessageIdx] = action.node;
      }
    }
  }

  const sendDisabled = disabled || uploading || (!input.trim() && !pendingImage) || loading;
  const canUpload = uploadEnabled && typeof onUploadImage === "function" && !disabled && !hideInput;

  return (
    <div style={styles.container}>
      <div ref={scrollRef} style={styles.messages}>
        {messages.length === 0 && emptyState && <div style={styles.empty}>{emptyState}</div>}
        {messages.map((msg, i) => {
          const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
          const hasText = msg.content && msg.content.trim();
          return (
            <div key={i}>
              <div style={msg.role === "user" ? styles.userRow : styles.assistantRow}>
                {msg.role === "assistant" && <div style={styles.avatar}>◆</div>}
                <div style={msg.role === "user" ? styles.userBubble : styles.assistantBubble}>
                  {attachments.length > 0 && (
                    <div style={styles.attachmentRow}>
                      {attachments.map((att, ai) => (
                        att.type === "image" && att.displayUrl ? (
                          <img
                            key={ai}
                            src={att.displayUrl}
                            alt={att.filename || "attachment"}
                            style={styles.attachmentImg}
                            onClick={() => setLightboxUrl(att.displayUrl)}
                          />
                        ) : null
                      ))}
                    </div>
                  )}
                  {hasText && msg.content.split("\n").map((line, j) => (
                    <p key={j} style={{ margin: line ? "0 0 8px" : "0", minHeight: line ? "auto" : 8 }}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              {actionsByIdx[i] && (
                <div style={styles.inlineActionWrap}>{actionsByIdx[i]}</div>
              )}
            </div>
          );
        })}
        {loading && (
          <div style={styles.assistantRow}>
            <div style={styles.avatar}>◆</div>
            <div style={styles.assistantBubble}>
              <span style={styles.dots}>● ● ●</span>
            </div>
          </div>
        )}
      </div>

      {!hideInput && (
        <>
          {pendingImage && (
            <div style={styles.pendingImageRow}>
              <img src={pendingImage.displayUrl} alt="pending" style={styles.pendingImg} />
              <div style={styles.pendingImageMeta}>
                <div style={styles.pendingImageName}>{pendingImage.filename}</div>
                <div style={styles.pendingImageHint}>Add a caption or send as-is.</div>
              </div>
              <button onClick={removePendingImage} style={styles.removeBtn} title="Remove image">✕</button>
            </div>
          )}
          {uploadError && <div style={styles.uploadError}>{uploadError}</div>}
          {uploading && <div style={styles.uploadingMsg}>Uploading image…</div>}

          <div style={styles.inputArea}>
            {canUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFilePick}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || loading}
                  style={{
                    ...styles.attachBtn,
                    opacity: (uploading || loading) ? 0.4 : 1,
                    cursor: (uploading || loading) ? "not-allowed" : "pointer",
                  }}
                  title="Attach an image or sketch"
                >
                  📎
                </button>
              </>
            )}
            <textarea
              style={{ ...styles.input, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "text" }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={pendingImage ? "Add a caption (optional)…" : (placeholder || "Type your response...")}
              rows={2}
              disabled={disabled}
            />
            <button
              onClick={handleSend}
              disabled={sendDisabled}
              style={{
                ...styles.sendBtn,
                opacity: sendDisabled ? 0.4 : 1,
                cursor: sendDisabled ? "not-allowed" : "pointer",
              }}
              title={disabled ? "Finish editing the capture first" : ""}
            >
              Send
            </button>
          </div>
        </>
      )}

      {lightboxUrl && (
        <div style={styles.lightboxBackdrop} onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="full size" style={styles.lightboxImg} />
          <button style={styles.lightboxClose} onClick={() => setLightboxUrl(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 0",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minHeight: 200,
  },
  empty: { color: theme.textDim, fontSize: 14, textAlign: "center", padding: 40 },
  userRow: { display: "flex", justifyContent: "flex-end" },
  assistantRow: { display: "flex", gap: 10, alignItems: "flex-start" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: theme.red,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  userBubble: {
    background: theme.red,
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "16px 16px 4px 16px",
    maxWidth: "75%",
    fontSize: 14,
    lineHeight: 1.6,
  },
  assistantBubble: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    padding: "10px 16px",
    borderRadius: "4px 16px 16px 16px",
    maxWidth: "85%",
    fontSize: 14,
    lineHeight: 1.6,
  },
  attachmentRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  attachmentImg: {
    maxWidth: 180,
    maxHeight: 180,
    borderRadius: 6,
    cursor: "pointer",
    objectFit: "cover",
    border: `1px solid rgba(255,255,255,0.15)`,
  },
  inlineActionWrap: { marginTop: 10, marginLeft: 38 },
  dots: { color: theme.textDim, animation: "pulse 1s infinite" },
  pendingImageRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 8,
  },
  pendingImg: {
    width: 60,
    height: 60,
    borderRadius: 6,
    objectFit: "cover",
    flexShrink: 0,
  },
  pendingImageMeta: { flex: 1, minWidth: 0 },
  pendingImageName: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pendingImageHint: { fontSize: 11, color: theme.textDim, marginTop: 2 },
  removeBtn: {
    background: "transparent",
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    color: theme.textMuted,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  uploadError: {
    fontSize: 12,
    color: theme.red,
    marginBottom: 8,
    padding: "6px 10px",
    background: theme.surface,
    border: `1px solid ${theme.red}`,
    borderRadius: 6,
  },
  uploadingMsg: {
    fontSize: 12,
    color: theme.textMuted,
    fontStyle: "italic",
    marginBottom: 8,
  },
  inputArea: { display: "flex", gap: 8, padding: "12px 0", alignItems: "stretch" },
  attachBtn: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    color: theme.text,
    padding: "0 12px",
    fontSize: 18,
    fontFamily: "'DM Sans', sans-serif",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    color: theme.text,
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    resize: "none",
    outline: "none",
  },
  sendBtn: {
    background: theme.red,
    border: "none",
    borderRadius: 8,
    color: "#fff",
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif",
  },
  lightboxBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    cursor: "pointer",
  },
  lightboxImg: {
    maxWidth: "90vw",
    maxHeight: "90vh",
    borderRadius: 8,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  lightboxClose: {
    position: "absolute",
    top: 20,
    right: 20,
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    color: theme.text,
    padding: "8px 14px",
    fontSize: 16,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
};
