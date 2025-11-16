import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/authService";
import { STALE_TIMES } from "../../shared/config/queryPatterns";
import type { LoginCredentials, SignUpCredentials } from "../types";

export const authKeys = {
	all: ["auth"] as const,
	session: () => [...authKeys.all, "session"] as const,
	user: () => [...authKeys.all, "user"] as const,
};

export function useAuthSession() {
	return useQuery({
		queryKey: authKeys.session(),
		queryFn: () => authService.getSession(),
		staleTime: STALE_TIMES.rare,
		retry: false,
	});
}

export function useCurrentUser() {
	return useQuery({
		queryKey: authKeys.user(),
		queryFn: () => authService.getCurrentUser(),
		staleTime: STALE_TIMES.rare,
		retry: false,
	});
}

export function useLoginMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (credentials: LoginCredentials) => authService.signIn(credentials),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: authKeys.all });
		},
	});
}

export function useSignUpMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (credentials: SignUpCredentials) => authService.signUp(credentials),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: authKeys.all });
		},
	});
}

export function useLogoutMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => authService.signOut(),
		onSuccess: () => {
			queryClient.clear();
		},
	});
}

export function useResetPasswordMutation() {
	return useMutation({
		mutationFn: (email: string) => authService.resetPassword(email),
	});
}
