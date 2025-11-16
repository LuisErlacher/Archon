import type { User as SupabaseUser, Session as SupabaseSession } from "@supabase/supabase-js";

export type User = SupabaseUser;
export type Session = SupabaseSession;

export interface AuthState {
	user: User | null;
	session: Session | null;
	isLoading: boolean;
	isAuthenticated: boolean;
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface SignUpCredentials {
	email: string;
	password: string;
	metadata?: {
		full_name?: string;
		[key: string]: unknown;
	};
}

export interface AuthError {
	message: string;
	status?: number;
}
