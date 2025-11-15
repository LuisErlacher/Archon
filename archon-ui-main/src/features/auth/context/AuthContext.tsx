import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authService } from "../services/authService";
import type { AuthState, User, Session } from "../types";

interface AuthContextValue extends AuthState {
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<void>;
	signOut: () => Promise<void>;
	resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		authService
			.getSession()
			.then((session) => {
				setSession(session);
				setUser(session?.user ?? null);
			})
			.catch((error) => {
				console.error("Error loading session:", error);
			})
			.finally(() => {
				setIsLoading(false);
			});

		const subscription = authService.onAuthStateChange((user, session) => {
			setUser(user);
			setSession(session);
			setIsLoading(false);
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	const signIn = async (email: string, password: string) => {
		setIsLoading(true);
		try {
			const { user, session } = await authService.signIn({ email, password });
			setUser(user);
			setSession(session);
		} finally {
			setIsLoading(false);
		}
	};

	const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
		setIsLoading(true);
		try {
			const { user, session } = await authService.signUp({
				email,
				password,
				metadata,
			});
			setUser(user);
			setSession(session);
		} finally {
			setIsLoading(false);
		}
	};

	const signOut = async () => {
		setIsLoading(true);
		try {
			await authService.signOut();
			setUser(null);
			setSession(null);
		} finally {
			setIsLoading(false);
		}
	};

	const resetPassword = async (email: string) => {
		await authService.resetPassword(email);
	};

	const value: AuthContextValue = {
		user,
		session,
		isLoading,
		isAuthenticated: !!user,
		signIn,
		signUp,
		signOut,
		resetPassword,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
