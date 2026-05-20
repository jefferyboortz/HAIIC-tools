import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    user_id,
    email,
    current_page,
    user_agent,
    trying_to_do,
    what_went_wrong,
    screenshot_storage_path,
  } = req.body || {};

  if (!user_id || !what_went_wrong || !what_went_wrong.trim()) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase env vars for submit-report route.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { error } = await supabase.from("bug_reports").insert({
      user_id,
      email: email || null,
      current_page: current_page || null,
      user_agent: user_agent || null,
      trying_to_do: trying_to_do || null,
      what_went_wrong: what_went_wrong.trim(),
      screenshot_storage_path: screenshot_storage_path || null,
    });

    if (error) {
      console.error("Bug report insert failed:", error);
      return res.status(500).json({ error: "Failed to save report." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Bug report submission error:", err);
    return res.status(500).json({ error: "Unexpected server error." });
  }
}
