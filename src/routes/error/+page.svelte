<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import logo from '$lib/assets/fundamental-health-logo.svg';

	const messages: Record<string, string> = {
		AccessDenied: "Your account doesn't have access to this app.",
		Configuration: 'There was a problem with the sign-in configuration.',
		Verification: 'That sign-in link is no longer valid.'
	};

	const code = $derived(page.url.searchParams.get('error') ?? '');
	const message = $derived(messages[code] ?? 'Something went wrong while signing in.');
</script>

<div class="flex min-h-[70vh] items-center justify-center px-6 py-16">
	<div class="w-full max-w-sm rounded-lg bg-white p-10 text-center shadow-sm">
		<a href={resolve('/')} class="inline-block">
			<img src={logo} alt="fundamental health" class="mx-auto h-9 w-auto" />
		</a>

		<h1 class="mt-6 text-2xl font-bold text-navy">Sign-in error</h1>
		<p class="mt-2 text-sm text-ink">{message}</p>

		<a
			href={resolve('/signin')}
			class="mt-8 inline-block w-full rounded-md bg-linear-to-r from-coral to-amber px-4 py-3 text-center text-sm font-bold tracking-wide text-white uppercase transition-colors duration-300 ease-in-out hover:from-coral hover:to-coral"
		>
			Sign in
		</a>
	</div>
</div>
