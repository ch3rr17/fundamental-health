<script lang="ts">
	import { resolve } from '$app/paths';

	type ImportResult = { imported: number; alreadyContacted: number; total: number };
	type ApolloList = { id: string; name: string; count: number };

	let source = $state<'csv' | 'apollo'>('apollo');

	// CSV state
	let file = $state<File | null>(null);

	// Apollo state
	let apolloLists = $state<ApolloList[]>([]);
	let apolloListsLoading = $state(false);
	let apolloListsError = $state('');
	let selectedListId = $state('');
	let apolloListsFetched = $state(false);

	// Shared state
	let loading = $state(false);
	let error = $state('');
	let result = $state<ImportResult | null>(null);

	function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		file = input.files?.[0] ?? null;
		result = null;
		error = '';
	}

	async function fetchApolloLists() {
		if (apolloListsFetched) return;
		apolloListsFetched = true;
		apolloListsLoading = true;
		apolloListsError = '';
		try {
			const res = await fetch('/api/apollo');
			const data = await res.json();
			if (!res.ok) {
				apolloListsError = data.error ?? 'Failed to load Apollo lists';
			} else {
				apolloLists = data;
				if (data[0]) selectedListId = data[0].id;
			}
		} catch {
			apolloListsError = 'Failed to load Apollo lists — check your connection and try again.';
		} finally {
			apolloListsLoading = false;
		}
	}

	function selectSource(next: 'csv' | 'apollo') {
		source = next;
		result = null;
		error = '';
		if (next === 'apollo') fetchApolloLists();
	}

	$effect(() => {
		fetchApolloLists();
	});

	async function submitCsv() {
		if (!file) return;
		loading = true;
		error = '';
		result = null;

		const formData = new FormData();
		formData.append('file', file);

		try {
			const res = await fetch('/api/prospects/import', { method: 'POST', body: formData });
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Import failed';
			} else {
				result = data;
			}
		} catch {
			error = 'Import failed — check your connection and try again.';
		} finally {
			loading = false;
		}
	}

	async function submitApolloPull() {
		if (!selectedListId) return;
		loading = true;
		error = '';
		result = null;

		try {
			const res = await fetch('/api/apollo/pull', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ labelId: selectedListId })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Pull failed';
			} else {
				result = data;
			}
		} catch {
			error = 'Pull failed — check your connection and try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="mx-auto max-w-xl px-6 py-16">
	<a href={resolve('/prospects')} class="text-xs font-bold text-periwinkle-dark hover:underline">← Back to Prospects</a>

	<h1 class="mt-3 text-2xl font-bold text-navy">Import Prospects</h1>
	<p class="mt-2 text-sm text-ink">
		Pull a segmented list straight from Apollo, or upload a CSV (Apollo's own export format is
		supported natively). Each row is checked for a prior contact, then assigned a talk-track
		segment.
	</p>

	<div class="mt-6 flex gap-2">
		<button
			onclick={() => selectSource('apollo')}
			class="flex-1 cursor-pointer rounded-md border px-4 py-2 text-sm font-bold {source === 'apollo'
				? 'border-coral text-coral'
				: 'border-cream-dim text-ink/60'}"
		>
			Apollo List
		</button>
		<button
			onclick={() => selectSource('csv')}
			class="flex-1 cursor-pointer rounded-md border px-4 py-2 text-sm font-bold {source === 'csv'
				? 'border-coral text-coral'
				: 'border-cream-dim text-ink/60'}"
		>
			CSV Upload
		</button>
	</div>

	<div class="mt-4 rounded-lg border border-cream-dim bg-white p-8 text-center">
		{#if source === 'apollo'}
			{#if apolloListsLoading}
				<p class="text-sm text-ink/60">Loading Apollo lists…</p>
			{:else if apolloListsError}
				<p class="text-sm font-bold text-coral">{apolloListsError}</p>
			{:else if apolloLists.length === 0}
				<p class="text-sm text-ink/60">No Apollo lists found.</p>
			{:else}
				<label class="mb-2 block text-left text-xs font-bold tracking-wide text-ink/60 uppercase" for="apollo-list">
					Select List
				</label>
				<select
					id="apollo-list"
					bind:value={selectedListId}
					class="w-full rounded-md border border-cream-dim px-3 py-2 text-sm font-bold text-ink"
				>
					{#each apolloLists as list (list.id)}
						<option value={list.id}>{list.name} ({list.count})</option>
					{/each}
				</select>
				{#if !result}
					<button
						onclick={submitApolloPull}
						disabled={!selectedListId || loading}
						class="mt-6 w-full cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-4 py-3 text-sm font-bold tracking-wide text-white uppercase transition-colors duration-300 ease-in-out hover:from-coral hover:to-coral disabled:cursor-not-allowed disabled:opacity-50"
					>
						{loading ? 'Importing…' : 'Import List'}
					</button>
				{:else}
					<p class="mt-6 text-sm font-bold text-navy">List imported</p>
				{/if}
			{/if}
		{:else}
			<input
				type="file"
				accept=".csv,text/csv"
				onchange={onFileChange}
				class="block w-full text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-cream-soft file:px-4 file:py-2 file:text-sm file:font-bold file:text-navy"
			/>

			{#if !result}
				<button
					onclick={submitCsv}
					disabled={!file || loading}
					class="mt-6 w-full cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-4 py-3 text-sm font-bold tracking-wide text-white uppercase transition-colors duration-300 ease-in-out hover:from-coral hover:to-coral disabled:cursor-not-allowed disabled:opacity-50"
				>
					{loading ? 'Importing…' : 'Import CSV'}
				</button>
			{:else}
				<p class="mt-6 text-sm font-bold text-navy">List imported</p>
			{/if}
		{/if}

		{#if error}
			<p class="mt-4 text-sm font-bold text-coral">{error}</p>
		{/if}

		{#if result}
			<a
				href={resolve('/prospects')}
				class="mt-6 inline-block rounded-md border border-coral px-4 py-3 text-sm font-bold tracking-wide text-coral uppercase hover:bg-coral hover:text-white"
			>
				Go to Prospects
			</a>
		{/if}
	</div>
</div>
