import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import { env } from '$env/dynamic/private';

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
		}
	}
});
