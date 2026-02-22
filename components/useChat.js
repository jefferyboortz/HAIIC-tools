import { useState } from "react";

export default function useChat(systemPrompt) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const send = async (userMsg, extraContext = "") => {
    const newMsgs = [...messages, { role: "user", content: userMsg }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt + (extraContext ? `\n\nAdditional context:\n${extraContext}` : ""),
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const text = data.content
        ?.map((item) => (item.type === "text" ? item.text : ""))
        .filter(Boolean)
        .join("\n");
      if (text) {
        setMessages([...newMsgs, { role: "assistant", content: text }]);
      }
    } catch {
      setMessages([
        ...newMsgs,
        { role: "assistant", content: "I'm having trouble connecting right now. Try sending your message again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setLoading(false);
  };

  return { messages, loading, send, reset };
}
