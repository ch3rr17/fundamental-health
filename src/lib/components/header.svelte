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
				class="inline-block cursor-pointer rounded-md border border-coral px-4 py-3 text-center text-sm font-bold tracking-wide text-coral uppercase transition-colors duration-300 ease-in-out hover:bg-coral hover:text-white"
			>
				Sign out
			</button>
		{/if}
	</div>
</header>
