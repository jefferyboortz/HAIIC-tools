async function urlToBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return { base64, mediaType: contentType };
  } catch (err) {
    console.error("Failed to fetch image for base64 conversion:", url, err);
    return null;
  }
}

async function buildMessageContent(message) {
  if (!message.attachments || message.attachments.length === 0) {
    return message.content;
  }

  const blocks = [];

  for (const att of message.attachments) {
    if (att.type === "image" && att.url) {
      const converted = await urlToBase64(att.url);
      if (converted) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: converted.mediaType,
            data: converted.base64,
          },
        });
      }
    }
  }

  if (message.content && message.content.trim()) {
    blocks.push({ type: "text", text: message.content });
  } else if (blocks.length > 0) {
    blocks.push({ type: "text", text: "[image attached]" });
  }

  return blocks;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { system, messages, max_tokens } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    const processedMessages = await Promise.all(
      messages.map(async (m) => ({
        role: m.role,
        content: await buildMessageContent(m),
      }))
    );

    const requestBody = {
      model: "claude-sonnet-4-20250514",
      max_tokens: max_tokens || 1000,
      messages: processedMessages,
    };

    if (system) {
      requestBody.system = system;
    }

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      console.error("Anthropic API error:", apiRes.status, errorText);
      return res.status(apiRes.status).json({
        error: "Anthropic API error",
        status: apiRes.status,
        details: errorText,
      });
    }

    const response = await apiRes.json();
    return res.status(200).json(response);
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      error: "API call failed",
      details: err.message,
    });
  }
}
