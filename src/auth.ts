import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import { env } from '$env/dynamic/private';

// Auth.js's default Google mapping only carries the combined display name onto
// session.user.name. Draft signatures need given/family name separately (see #36),
// so these are threaded through explicitly: raw OAuth profile -> jwt -> session.
declare module '@auth/core/types' {
	interface User {
		givenName?: string | null;
		familyName?: string | null;
	}
}

declare module '@auth/core/jwt' {
	interface JWT {
		givenName?: string | null;
		familyName?: string | null;
	}
}

const ALLOWED_EMAILS = new Set(
	(env.AUTH_ALLOWED_EMAILS ?? '')
		.split(',')
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean)
);

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [Google],
	pages: {
		error: '/error'
	},
	callbacks: {
		async signIn({ profile }) {
			return (
				profile?.email_verified === true &&
				!!profile.email &&
				ALLOWED_EMAILS.has(profile.email.toLowerCase())
			);
		},
		async jwt({ token, profile }) {
			if (profile) {
				token.givenName = profile.given_name;
				token.familyName = profile.family_name;
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				session.user.givenName = token.givenName;
				session.user.familyName = token.familyName;
			}
			return session;
		}
	}
});
