import { useState, useRef, useEffect } from "react";
import theme from "./theme";

export default function ChatThread({ messages, loading, onSend, placeholder, emptyState }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div style={styles.container}>
      <div ref={scrollRef} style={styles.messages}>
        {messages.length === 0 && emptyState && <div style={styles.empty}>{emptyState}</div>}
        {messages.map((msg, i) => (
          <div key={i} style={msg.role === "user" ? styles.userRow : styles.assistantRow}>
            {msg.role === "assistant" && <div style={styles.avatar}>◆</div>}
            <div style={msg.role === "user" ? styles.userBubble : styles.assistantBubble}>
              {msg.content.split("\n").map((line, j) => (
                <p key={j} style={{ margin: line ? "0 0 8px" : "0", minHeight: line ? "auto" : 8 }}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div style={styles.assistantRow}>
            <div style={styles.avatar}>◆</div>
            <div style={styles.assistantBubble}>
              <span style={styles.dots}>● ● ●</span>
            </div>
          </div>
        )}
      </div>
      <div style={styles.inputArea}>
        <textarea
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder || "Type your response..."}
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            ...styles.sendBtn,
            opacity: !input.trim() || loading ? 0.4 : 1,
          }}
        >
          Send
        </button>
      </div>
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
    maxHeight: 400,
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
  dots: { color: theme.textDim, animation: "pulse 1s infinite" },
  inputArea: { display: "flex", gap: 8, padding: "12px 0" },
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
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
};
