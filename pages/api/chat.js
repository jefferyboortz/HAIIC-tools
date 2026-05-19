import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  // If no attachments, return content as plain string (backward compatible)
  if (!message.attachments || message.attachments.length === 0) {
    return message.content;
  }

  // Build array of content blocks: images first, then text
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

    // Process messages, converting attachments to image content blocks
    const processedMessages = await Promise.all(
      messages.map(async (m) => ({
        role: m.role,
        content: await buildMessageContent(m),
      }))
    );

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: max_tokens || 1000,
      system: system || undefined,
      messages: processedMessages,
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error("Anthropic API error:", err);
    return res.status(500).json({
      error: "API call failed",
      details: err.message,
    });
  }
}
