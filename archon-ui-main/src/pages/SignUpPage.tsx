import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/context/AuthContext";

export function SignUpPage() {
	const navigate = useNavigate();
	const { signUp, isLoading } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		if (password.length < 6) {
			setError("Password must be at least 6 characters long");
			return;
		}

		try {
			await signUp(email, password);
			setSuccess(true);
			setTimeout(() => {
				navigate("/");
			}, 2000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred during sign up");
		}
	};

	if (success) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
				<div className="w-full max-w-md px-6">
					<div className="bg-gray-800/50 backdrop-blur-md border border-cyan-500/30 rounded-lg p-8 shadow-2xl text-center">
						<div className="mb-4">
							<svg
								className="w-16 h-16 text-green-500 mx-auto"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<h2 className="text-2xl font-bold text-cyan-400 mb-2">Account Created!</h2>
						<p className="text-gray-400">Redirecting to your dashboard...</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
			<div className="w-full max-w-md px-6">
				<div className="bg-gray-800/50 backdrop-blur-md border border-cyan-500/30 rounded-lg p-8 shadow-2xl">
					<div className="mb-8 text-center">
						<h1 className="text-3xl font-bold text-cyan-400 mb-2">Archon</h1>
						<p className="text-gray-400">Create your account</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6">
						{error && (
							<div className="bg-red-500/10 border border-red-500/50 rounded-md p-3 text-red-400 text-sm">
								{error}
							</div>
						)}

						<div>
							<label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
								Email
							</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								disabled={isLoading}
								className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
								placeholder="you@example.com"
							/>
						</div>

						<div>
							<label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
								Password
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								disabled={isLoading}
								className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
								placeholder="••••••••"
							/>
							<p className="mt-1 text-xs text-gray-500">At least 6 characters</p>
						</div>

						<div>
							<label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
								Confirm Password
							</label>
							<input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								disabled={isLoading}
								className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
								placeholder="••••••••"
							/>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900"
						>
							{isLoading ? "Creating account..." : "Create account"}
						</button>
					</form>

					<div className="mt-6 text-center text-sm">
						<p className="text-gray-400">
							Already have an account?{" "}
							<Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">
								Sign in
							</Link>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
