<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { SEGMENT_LABELS, SEGMENT_ORDER } from '$lib/segments';
	import type { TalkTrackSegment } from '$lib/types';

	interface BoardProspect {
		id: string;
		name: string;
		role: string;
		org: (city: string) => string;
		email: string;
		avatarUrl: string;
		netWorth: string;
		segment: TalkTrackSegment;
		match: number;
	}

	const CITIES = ['San Diego', 'Los Angeles', 'San Francisco', 'Sacramento', 'Phoenix'];

	// Demo data until the real discovery pipeline exists. Org names are
	// templated with the selected city so any search reads coherently.
	const DEMO_RESULTS: BoardProspect[] = [
		{
			id: 'b1',
			email: 'patricia.whitfield@gmail.com',
			name: 'Patricia Whitfield',
			role: 'Board Chair',
			org: (city) => `NAMI ${city}`,
			avatarUrl: 'https://i.pravatar.cc/96?img=47',
			netWorth: '$25M+',
			segment: 'board-prospects',
			match: 96
		},
		{
			id: 'b2',
			email: 'robert.kang@outlook.com',
			name: 'Robert Kang',
			role: 'Treasurer',
			org: (city) => `Mental Health America of ${city}`,
			avatarUrl: 'https://i.pravatar.cc/96?img=12',
			netWorth: '$10M-$25M',
			segment: 'financial-cra',
			match: 92
		},
		{
			id: 'b3',
			email: 'diane.castellano@gmail.com',
			name: 'Diane Castellano',
			role: 'Trustee',
			org: (city) => `${city} Behavioral Health Foundation`,
			avatarUrl: 'https://i.pravatar.cc/96?img=32',
			netWorth: '$25M+',
			segment: 'daf-giving-circles',
			match: 90
		},
		{
			id: 'b4',
			email: 'steven.marsh@yahoo.com',
			name: 'Steven Marsh',
			role: 'Vice Chair',
			org: (city) => `NAMI ${city}`,
			avatarUrl: 'https://i.pravatar.cc/96?img=59',
			netWorth: '$10M-$25M',
			segment: 'board-prospects',
			match: 88
		},
		{
			id: 'b5',
			email: 'angela.reyes@gmail.com',
			name: 'Angela Reyes',
			role: 'Director',
			org: (city) => `Hope Alliance of ${city}`,
			avatarUrl: 'https://i.pravatar.cc/96?img=25',
			netWorth: '$5M-$10M',
			segment: 'community-donors',
			match: 85
		},
		{
			id: 'b6',
			email: 'wfoster@icloud.com',
			name: 'William Foster',
			role: 'Director Emeritus',
			org: (city) => `Mental Health America of ${city}`,
			avatarUrl: 'https://i.pravatar.cc/96?img=53',
			netWorth: '$25M+',
			segment: 'daf-giving-circles',
			match: 83
		},
		{
			id: 'b7',
			email: 'sandra.liu@gmail.com',
			name: 'Sandra Liu',
			role: 'Secretary',
			org: (city) => `${city} Behavioral Health Foundation`,
			avatarUrl: 'https://i.pravatar.cc/96?img=44',
			netWorth: '$5M-$10M',
			segment: 'community-donors',
			match: 79
		},
		{
			id: 'b8',
			email: 'gregory.ashford@outlook.com',
			name: 'Gregory Ashford',
			role: 'Trustee',
			org: (city) => `Hope Alliance of ${city}`,
			avatarUrl: 'https://i.pravatar.cc/96?img=68',
			netWorth: '$10M-$25M',
			segment: 'financial-cra',
			match: 74
		}
	];

	let city = $state(CITIES[0]);
	const selected = new SvelteSet<string>();
	let addedMessage = $state('');

	function toggleSelectAll() {
		if (!results) return;
		if (selected.size === results.length) selected.clear();
		else for (const p of results) selected.add(p.id);
	}

	function addSelected() {
		if (selected.size === 0) return;
		addedMessage = `${selected.size} ${selected.size === 1 ? 'prospect' : 'prospects'} added`;
		selected.clear();
	}
	const segmentFilter = new SvelteSet<TalkTrackSegment>();
	let segmentPanelOpen = $state(false);
	let segmentWrapperEl = $state<HTMLElement | undefined>();
	let searching = $state(false);
	let results = $state<BoardProspect[] | null>(null);
	let searchedCity = $state('');
	let searchedSegmentLabel = $state<string | null>(null);

	const searchedOrgCount = $derived(
		results ? new Set(results.map((p) => p.org(searchedCity))).size : 0
	);

	function toggleSegment(seg: TalkTrackSegment) {
		if (segmentFilter.has(seg)) segmentFilter.delete(seg);
		else segmentFilter.add(seg);
	}

	function toggleAllSegments() {
		if (segmentFilter.size === SEGMENT_ORDER.length) segmentFilter.clear();
		else for (const seg of SEGMENT_ORDER) segmentFilter.add(seg);
	}

	function closePanels(e: MouseEvent) {
		if (!segmentWrapperEl?.contains(e.target as Node)) segmentPanelOpen = false;
	}

	async function discover() {
		if (searching) return;
		searching = true;
		// Snapshot the filter so panel changes mid-search don't shift the results.
		const useFilter =
			segmentFilter.size > 0 && segmentFilter.size < SEGMENT_ORDER.length
				? new Set(segmentFilter)
				: null;
		// Fake latency so the demo shows the loading state.
		await new Promise((r) => setTimeout(r, 900));
		searchedCity = city;
		searchedSegmentLabel = useFilter
			? useFilter.size === 1
				? SEGMENT_LABELS[[...useFilter][0]]
				: `${useFilter.size} Segments`
			: null;
		// Demo mode: always show the full card set no matter what was searched,
		// but retag each card with the selected segments so the pills line up
		// with the filter.
		const segs = useFilter ? [...useFilter] : null;
		results = segs
			? DEMO_RESULTS.map((p, i) => ({ ...p, segment: segs[i % segs.length] }))
			: DEMO_RESULTS;
		selected.clear();
		addedMessage = '';
		searching = false;
	}

	function matchClass(match: number) {
		if (match >= 85) return 'bg-sky text-periwinkle-dark';
		if (match >= 75) return 'bg-amber/20 text-amber';
		return 'bg-cream-dim text-ink/70';
	}
</script>

<svelte:window onclick={closePanels} />

<div class="mx-auto max-w-6xl px-8 py-16">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-navy">Discover Prospects</h1>
		<a href={resolve('/prospects')} class="text-xs font-bold text-periwinkle-dark hover:underline">
			View Prospects →
		</a>
	</div>
	<p class="mt-2 text-sm text-ink/60">
		Pick a city and select a segment to return a list of potential prospects.
	</p>

	<div class="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-cream-dim bg-white p-4">
		<label class="min-w-45 flex-1">
			<span class="text-xs font-bold tracking-wide text-ink/60 uppercase">Select a City</span>
			<select
				bind:value={city}
				class="mt-1 w-full cursor-pointer rounded-md border border-cream-dim bg-white px-3 py-2 text-sm font-bold text-ink"
			>
				{#each CITIES as c (c)}
					<option value={c}>{c}</option>
				{/each}
			</select>
		</label>
		<div class="min-w-45">
			<span class="text-xs font-bold tracking-wide text-ink/60 uppercase">Select a Segment</span>
			<div class="relative mt-1" bind:this={segmentWrapperEl}>
				<button
					onclick={() => (segmentPanelOpen = !segmentPanelOpen)}
					class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-cream-dim bg-white px-3 py-2 text-left text-sm font-bold text-ink"
				>
					<span>
						{segmentFilter.size === 0 || segmentFilter.size === SEGMENT_ORDER.length
							? 'All Segments'
							: segmentFilter.size === 1
								? SEGMENT_LABELS[[...segmentFilter][0]]
								: `${segmentFilter.size} Segments selected`}
					</span>
					<svg
						width="10"
						height="6"
						viewBox="0 0 10 6"
						fill="none"
						class="shrink-0 transition-transform duration-150 {segmentPanelOpen ? 'rotate-180' : ''}"
					>
						<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
				{#if segmentPanelOpen}
					<div class="absolute top-full left-0 z-20 mt-1 min-w-55 rounded-md border border-cream-dim bg-white p-2 shadow-lg">
						<label class="flex items-center gap-2 rounded px-2 py-1.5 text-sm font-bold hover:bg-cream-soft">
							<input
								type="checkbox"
								checked={segmentFilter.size === SEGMENT_ORDER.length}
								onchange={toggleAllSegments}
								class="accent-coral"
							/>
							All
						</label>
						<div class="my-1 border-t border-cream-dim"></div>
						{#each SEGMENT_ORDER as seg (seg)}
							<label class="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-cream-soft">
								<input
									type="checkbox"
									checked={segmentFilter.has(seg)}
									onchange={() => toggleSegment(seg)}
									class="accent-coral"
								/>
								{SEGMENT_LABELS[seg]}
							</label>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<button
			onclick={discover}
			disabled={searching}
			class="flex h-[38px] cursor-pointer items-center rounded-md bg-linear-to-r from-coral to-amber px-3 text-xs font-bold tracking-wide text-white uppercase transition-colors duration-300 ease-in-out hover:from-coral hover:to-coral disabled:cursor-not-allowed disabled:opacity-50"
		>
			{searching ? 'Discovering…' : 'Discover'}
		</button>
	</div>

	{#if searching}
		<p class="mt-10 text-center text-sm text-ink/60">
			Scanning mental health nonprofits in {city} and reviewing their board members…
		</p>
	{:else if results === null}
		<!-- Nothing to show until the first search runs. -->
	{:else}
		<div class="mt-8 flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-ink/60">
				{results.length} high net worth board members found across
				<span class="font-bold text-ink">{searchedOrgCount} mental health nonprofits</span>
				in <span class="font-bold text-ink">{searchedCity}</span>
				{#if searchedSegmentLabel}for <span class="font-bold text-ink">{searchedSegmentLabel}</span>{/if}
			</p>
			<div class="flex items-center gap-3">
				{#if addedMessage}
					<span class="text-xs text-ink/60">{addedMessage}</span>
				{/if}
				<button
					onclick={addSelected}
					disabled={selected.size === 0}
					class="cursor-pointer rounded-md border border-coral px-3 py-1.5 text-xs font-bold tracking-wide text-coral uppercase transition-colors duration-300 ease-in-out hover:bg-coral hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
				>
					Add to Prospects{selected.size > 0 ? ` (${selected.size})` : ''}
				</button>
			</div>
		</div>
		<label class="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-ink/70">
			<input
				type="checkbox"
				checked={selected.size === results.length}
				onchange={toggleSelectAll}
				class="accent-coral"
			/>
			Select all
		</label>
		<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each results as person (person.id)}
				<div class="flex flex-col rounded-lg border border-cream-dim bg-white p-5">
					<div class="flex items-start justify-between gap-3">
						<div class="flex items-start gap-3">
							<input
								type="checkbox"
								checked={selected.has(person.id)}
								onchange={() =>
									selected.has(person.id) ? selected.delete(person.id) : selected.add(person.id)}
								aria-label={`Select ${person.name}`}
								class="mt-0.5 cursor-pointer accent-coral"
							/>
							<img
								src={person.avatarUrl}
								alt={person.name}
								class="h-12 w-12 rounded-full border border-cream-dim object-cover"
							/>
						</div>
						<div class="flex flex-wrap items-center justify-end gap-1.5">
							<span class="rounded-full bg-navy/10 px-2.5 py-1 text-xs font-bold text-navy">
								{SEGMENT_LABELS[person.segment]}
							</span>
							<span class="rounded-full px-2.5 py-1 text-xs font-bold {matchClass(person.match)}">
								{person.match}% match
							</span>
						</div>
					</div>

					<p class="mt-4 font-bold text-navy">{person.name}</p>
					<p class="mt-0.5 text-sm text-ink/70">{person.role}, {person.org(searchedCity)}</p>
					<p class="mt-1 text-xs text-ink/60">{person.email}</p>
					<p class="mt-1 text-xs text-ink/60">
						Est. net worth <span class="font-bold text-ink">{person.netWorth}</span>
					</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
