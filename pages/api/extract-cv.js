// HAIIC — CV extraction endpoint
// Accepts a PDF, returns the seven profile categories as JSON

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const EXPECTED_KEYS = [
  "work",
  "education",
  "skills",
  "hobbies",
  "passions",
  "lived_experience",
  "values_worldview",
];

const SYSTEM_PROMPT = `You are a CV extraction assistant for HAIIC. Read the CV and extract information into structured profile categories.

Return ONLY a valid JSON object — no preamble, no markdown code fences, no explanation before or after. The object must have exactly these seven keys, all with string values:

- work: Work experience as a flowing summary — years, roles, organizations, key responsibilities. 2-4 sentences.
- education: Educational background — schools, degrees, fields, years. 1-3 sentences.
- skills: Skills, technical abilities, tools, languages, certifications. 1-3 sentences.
- hobbies: Personal interests if mentioned in the CV. Empty string if none.
- passions: Always empty string. The user will fill this themselves.
- lived_experience: Always empty string. The user will fill this themselves.
- values_worldview: Always empty string. The user will fill this themselves.

Voice: factual and warm, concise CV-summary style. Write about the person without using "they," "the candidate," "I," or "you" — declarative phrases like "Senior nurse practitioner at Emory (2018-present)." Be specific to what's actually in the CV. Don't embellish or invent details.

Example output:
{"work":"Senior nurse practitioner at Emory Hospital (2018-present), specializing in emergency medicine. Previously staff RN at Grady Memorial (2010-2018), focused on trauma care.","education":"BSN from University of Michigan (2010), MSN from Emory University (2015).","skills":"Emergency medicine, trauma response, patient triage, IV insertion, EHR systems (Epic, Cerner). BLS and ACLS certified.","hobbies":"Beekeeping and weekend gardening.","passions":"","lived_experience":"","values_worldview":""}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { base64, mimeType } = req.body || {};

  if (!base64 || !mimeType) {
    return res.status(400).json({ error: "Missing file data." });
  }

  if (mimeType !== "application/pdf") {
    return res.status(400).json({
      error: "Please upload a PDF. If your CV is in Word, use File → Export → PDF first.",
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY env var");
    return res.status(500).json({ error: "Server misconfiguration. Please contact support." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Extract this CV into the seven profile categories. Return only the JSON object — no markdown, no preamble.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(500).json({ error: "Couldn't process the CV right now. Please try again in a moment." });
    }

    const data = await response.json();
    const text = data.content
      ?.map((item) => (item.type === "text" ? item.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      return res.status(500).json({ error: "Got an empty response from the model. Please try again." });
    }

    // Strip markdown fences in case the model added them despite instructions
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("JSON parse error:", err, "Raw response:", text);
      return res.status(500).json({ error: "Couldn't read the extraction. Please try uploading again." });
    }

    // Validate and normalize — always return all seven keys
    const categories = {};
    for (const key of EXPECTED_KEYS) {
      categories[key] = typeof parsed[key] === "string" ? parsed[key] : "";
    }

    return res.status(200).json({ categories });
  } catch (err) {
    console.error("Extract CV error:", err);
    return res.status(500).json({ error: "Something went wrong on our end. Please try again." });
  }
}
