<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { signOut } from '@auth/sveltekit/client';
	import logo from '$lib/assets/fundamental-health-logo.svg';
</script>

<header class="sticky top-0 z-999 bg-cream py-7.5">
	<div class="mx-auto flex max-w-[1640px] items-center justify-between px-[4%]">
		<a href={resolve('/')} class="block shrink-0">
			<img src={logo} alt="fundamental health" class="h-10 w-auto" />
		</a>

		{#if page.data.session}
			<button
				onclick={() => signOut({ redirectTo: resolve('/') })}
				class="inline-block rounded-md bg-linear-to-r from-coral to-amber px-4 py-3 text-center text-sm font-bold tracking-wide text-white uppercase transition-colors duration-300 ease-in-out hover:from-coral hover:to-coral"
			>
				Sign out
			</button>
		{:else}
			<a
				href={resolve('/signin')}
				class="inline-block rounded-md bg-linear-to-r from-coral to-amber px-4 py-3 text-center text-sm font-bold tracking-wide text-white uppercase transition-colors duration-300 ease-in-out hover:from-coral hover:to-coral"
			>
				Sign in
			</a>
		{/if}
	</div>
</header>
