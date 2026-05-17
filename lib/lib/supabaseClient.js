import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://quruzppflgdbddxyylxu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnV6cHBmbGdkYmRkeHl5bHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDQ1NTEsImV4cCI6MjA4OTE4MDU1MX0.y6acgCo6EZZiEDIJHSx6J3T60L1P6M_DH3vTIulFvJ0";

// Determine persistence preference based on what the user chose at sign-in time.
// If they checked "Keep me signed in on this device", we persist to localStorage.
// Otherwise, we use sessionStorage which is cleared when the browser tab closes.
//
// This evaluates only in the browser (typeof window !== "undefined") so it
// doesn't break server-side rendering during the build.
function getStorageMode() {
  if (typeof window === "undefined") return null;
  try {
    const keep = window.localStorage.getItem("haiic-keep-signed-in");
    return keep === "true" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: getStorageMode(),
    storageKey: "haiic-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
