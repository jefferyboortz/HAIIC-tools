import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://quruzppflgdbddxyylxu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnV6cHBmbGdkYmRkeHl5bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDQ1NTEsImV4cCI6MjA4OTE4MDU1MX0.y6acgCo6EZZiEDIJHSx6J3T60L1P6M_DH3vTIulFvJ0";

// Determine storage based on what the user chose at sign-in time.
// localStorage = persists across browser restarts (Keep me signed in)
// sessionStorage = cleared when the tab/window closes (default — safer for shared computers)
function getStorageMode() {
  if (typeof window === "undefined") return undefined;
  try {
    const keep = window.localStorage.getItem("haiic-keep-signed-in");
    return keep === "true" ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

// True singleton across Next.js page bundles.
// Each page's JS bundle would normally create its own client instance.
// We cache the client on globalThis so the first page to load creates it,
// and every subsequent page finds the existing one and reuses it.
function getSupabase() {
  if (typeof globalThis !== "undefined") {
    if (!globalThis.__haiicSupabase) {
      globalThis.__haiicSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: getStorageMode(),
          storageKey: "haiic-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });
    }
    return globalThis.__haiicSupabase;
  }
  // Fallback for any environment where globalThis isn't available
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: getStorageMode(),
      storageKey: "haiic-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

const supabase = getSupabase();

export default supabase;
