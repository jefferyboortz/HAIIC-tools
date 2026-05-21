export default function handler(req, res) {
  res.status(200).json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anthropicKeyLen: process.env.ANTHROPIC_API_KEY?.length || 0,
    supabaseUrlLen: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
    serviceKeyLen: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    allEnvKeys: Object.keys(process.env).filter(k =>
      k.includes("SUPABASE") || k.includes("ANTHROPIC") || k.includes("NEXT")
    ),
  });
}
