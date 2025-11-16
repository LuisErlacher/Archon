import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging
console.log("🔍 Supabase Config Debug:", {
	url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : "MISSING",
	anonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : "MISSING",
	allEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
});

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error(
		`Missing Supabase environment variables!\n` +
		`VITE_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}\n` +
		`VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'MISSING'}\n` +
		`Available VITE_ vars: ${Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')).join(', ')}\n` +
		`Please ensure .env file is in the root directory (/home/luis/projetos/Archon/.env) and restart the Vite dev server.`
	);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
		storage: window.localStorage,
	},
});
