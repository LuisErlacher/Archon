import { supabase } from "../config/supabaseClient";
import type { LoginCredentials, SignUpCredentials, User, Session } from "../types";

export const authService = {
	async signIn(credentials: LoginCredentials): Promise<{ user: User; session: Session }> {
		const { data, error } = await supabase.auth.signInWithPassword({
			email: credentials.email,
			password: credentials.password,
		});

		if (error) {
			throw new Error(error.message);
		}

		if (!data.user || !data.session) {
			throw new Error("Login failed: No user or session returned");
		}

		return {
			user: data.user,
			session: data.session,
		};
	},

	async signUp(credentials: SignUpCredentials): Promise<{ user: User; session: Session | null }> {
		const { data, error } = await supabase.auth.signUp({
			email: credentials.email,
			password: credentials.password,
			options: {
				data: credentials.metadata || {},
			},
		});

		if (error) {
			throw new Error(error.message);
		}

		if (!data.user) {
			throw new Error("Sign up failed: No user returned");
		}

		return {
			user: data.user,
			session: data.session,
		};
	},

	async signOut(): Promise<void> {
		const { error } = await supabase.auth.signOut();

		if (error) {
			throw new Error(error.message);
		}
	},

	async getCurrentUser(): Promise<User | null> {
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser();

		if (error) {
			throw new Error(error.message);
		}

		return user;
	},

	async getSession(): Promise<Session | null> {
		const {
			data: { session },
			error,
		} = await supabase.auth.getSession();

		if (error) {
			throw new Error(error.message);
		}

		return session;
	},

	async resetPassword(email: string): Promise<void> {
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/reset-password`,
		});

		if (error) {
			throw new Error(error.message);
		}
	},

	async updatePassword(newPassword: string): Promise<void> {
		const { error } = await supabase.auth.updateUser({
			password: newPassword,
		});

		if (error) {
			throw new Error(error.message);
		}
	},

	onAuthStateChange(callback: (user: User | null, session: Session | null) => void) {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			callback(session?.user ?? null, session);
		});

		return subscription;
	},
};
