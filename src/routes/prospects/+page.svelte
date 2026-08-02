<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { SEGMENT_LABELS, SEGMENT_ORDER, STATUS_LABELS, QUEUE_STATUSES } from '$lib/segments';
	import type { Prospect, ProspectStatus, SegmentAssignment, TalkTrackSegment } from '$lib/types';

	let { data } = $props();
	const prospects = $derived(data.prospects as Prospect[]);

	let tab = $state<'queue' | 'already-contacted' | 'unassigned'>('queue');
	let searchQuery = $state('');
	let contactedSearchQuery = $state('');
	let unassignedSearchQuery = $state('');
	const segmentFilter = new SvelteSet<TalkTrackSegment>();
	const statusFilter = new SvelteSet<ProspectStatus>();
	let segmentPanelOpen = $state(false);
	let statusPanelOpen = $state(false);
	let segmentWrapperEl = $state<HTMLElement | undefined>();
	let statusWrapperEl = $state<HTMLElement | undefined>();

	const queueRows = $derived(
		prospects.filter((p) => p.status !== 'already-contacted' && p.segment !== 'unassigned')
	);
	const alreadyContactedRows = $derived(prospects.filter((p) => p.status === 'already-contacted'));
	const unassignedRows = $derived(
		prospects.filter((p) => p.segment === 'unassigned' && p.status !== 'already-contacted')
	);

	const filteredQueueRows = $derived(
		queueRows.filter((p) => {
			const matchesSegment = segmentFilter.size === 0 || segmentFilter.has(p.segment as TalkTrackSegment);
			const matchesStatus = statusFilter.size === 0 || statusFilter.has(p.status);
			const query = searchQuery.trim().toLowerCase();
			const matchesSearch =
				query === '' ||
				`${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
				(p.organization ?? '').toLowerCase().includes(query) ||
				(p.title ?? '').toLowerCase().includes(query);
			return matchesSegment && matchesStatus && matchesSearch;
		})
	);

	const filteredAlreadyContactedRows = $derived(
		alreadyContactedRows.filter((p) => {
			const query = contactedSearchQuery.trim().toLowerCase();
			return (
				query === '' ||
				`${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
				(p.organization ?? '').toLowerCase().includes(query)
			);
		})
	);

	const filteredUnassignedRows = $derived(
		unassignedRows.filter((p) => {
			const query = unassignedSearchQuery.trim().toLowerCase();
			return (
				query === '' ||
				`${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
				(p.organization ?? '').toLowerCase().includes(query) ||
				(p.title ?? '').toLowerCase().includes(query)
			);
		})
	);

	function toggleSegment(seg: TalkTrackSegment) {
		if (segmentFilter.has(seg)) segmentFilter.delete(seg);
		else segmentFilter.add(seg);
	}

	function toggleStatus(s: ProspectStatus) {
		if (statusFilter.has(s)) statusFilter.delete(s);
		else statusFilter.add(s);
	}

	function toggleAllSegments() {
		if (segmentFilter.size === SEGMENT_ORDER.length) segmentFilter.clear();
		else for (const seg of SEGMENT_ORDER) segmentFilter.add(seg);
	}

	function toggleAllStatuses() {
		if (statusFilter.size === QUEUE_STATUSES.length) statusFilter.clear();
		else for (const s of QUEUE_STATUSES) statusFilter.add(s);
	}

	function closePanels(e: MouseEvent) {
		const target = e.target as Node;
		if (!segmentWrapperEl?.contains(target)) segmentPanelOpen = false;
		if (!statusWrapperEl?.contains(target)) statusPanelOpen = false;
	}

	function segmentLabel(seg: string) {
		if (seg === 'unassigned') return 'Unassigned';
		return SEGMENT_LABELS[seg as TalkTrackSegment] ?? seg;
	}

	function segmentChipClass(seg: SegmentAssignment) {
		if (seg === 'unassigned') return 'bg-cream-soft text-ink';
		const map: Record<TalkTrackSegment, string> = {
			'community-donors': 'bg-navy/10 text-navy',
			'nonprofit-marketing': 'bg-periwinkle/15 text-periwinkle',
			'board-prospects': 'bg-navy/20 text-navy',
			'financial-cra': 'bg-ink/8 text-ink',
			'daf-giving-circles': 'bg-periwinkle/25 text-periwinkle'
		};
		return map[seg];
	}

	function statusChipClass(status: ProspectStatus) {
		if (status === 'send-confirmed' || status === 'logged') return 'bg-sky text-periwinkle-dark';
		if (status === 'approved' || status === 'pushed') return 'bg-amber/20 text-amber';
		if (status === 'draft-ready') return 'bg-coral/15 text-coral';
		return 'bg-cream-dim text-ink/70';
	}

	function openProspect(id: string) {
		goto(resolve('/prospects/[id]', { id }));
	}
</script>

<svelte:window onclick={closePanels} />

<div class="mx-auto max-w-5xl px-8 py-16">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-navy">Prospects</h1>
		<a
			href={resolve('/import')}
			class="rounded-md bg-linear-to-r from-coral to-amber px-4 py-3 text-sm font-bold tracking-wide text-white uppercase hover:from-coral hover:to-coral"
		>
			+ Import Prospects
		</a>
	</div>

	<div class="mt-8 flex gap-10 border-b border-cream-dim">
		<button
			onclick={() => (tab = 'queue')}
			class="cursor-pointer border-b-2 px-1 py-2 text-sm font-bold {tab === 'queue'
				? 'border-coral text-navy'
				: 'border-transparent text-ink/60'}"
		>
			Review Prospects <span class="ml-1 font-normal text-ink/50">{queueRows.length}</span>
		</button>
		<button
			onclick={() => (tab = 'already-contacted')}
			class="cursor-pointer border-b-2 px-3 py-2 text-sm font-bold {tab === 'already-contacted'
				? 'border-coral text-navy'
				: 'border-transparent text-ink/60'}"
		>
			Previously Contacted <span class="ml-1 font-normal text-ink/50">{alreadyContactedRows.length}</span>
		</button>
		<button
			onclick={() => (tab = 'unassigned')}
			class="cursor-pointer border-b-2 px-3 py-2 text-sm font-bold {tab === 'unassigned'
				? 'border-coral text-navy'
				: 'border-transparent text-ink/60'}"
		>
			Segment not assigned <span class="ml-1 font-normal text-ink/50">{unassignedRows.length}</span>
		</button>
	</div>

	{#if tab === 'queue'}
		<div class="mt-6 flex flex-wrap justify-end gap-3">
			<div class="relative min-w-45 flex-1">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search prospects…"
					class="w-full rounded-md border border-cream-dim bg-white px-3 py-2 pr-8 text-sm text-ink placeholder:text-ink/40"
				/>
				{#if searchQuery}
					<button
						onclick={() => (searchQuery = '')}
						aria-label="Clear search"
						class="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-ink/40 hover:text-ink"
					>
						×
					</button>
				{/if}
			</div>
			<div class="relative" bind:this={segmentWrapperEl}>
				<button
					onclick={() => {
						segmentPanelOpen = !segmentPanelOpen;
						statusPanelOpen = false;
					}}
					class="flex min-w-45 cursor-pointer items-center justify-between gap-2 rounded-md border border-cream-dim bg-white px-3 py-2 text-left text-sm font-bold text-ink"
				>
					<span>
						{segmentFilter.size === 0 || segmentFilter.size === SEGMENT_ORDER.length
							? 'Segment'
							: segmentFilter.size === 1
								? segmentLabel([...segmentFilter][0])
								: `${segmentFilter.size} verticals selected`}
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

			<div class="relative" bind:this={statusWrapperEl}>
				<button
					onclick={() => {
						statusPanelOpen = !statusPanelOpen;
						segmentPanelOpen = false;
					}}
					class="flex min-w-45 cursor-pointer items-center justify-between gap-2 rounded-md border border-cream-dim bg-white px-3 py-2 text-left text-sm font-bold text-ink"
				>
					<span>
						{statusFilter.size === 0 || statusFilter.size === QUEUE_STATUSES.length
							? 'Status'
							: statusFilter.size === 1
								? STATUS_LABELS[[...statusFilter][0]]
								: `${statusFilter.size} statuses selected`}
					</span>
					<svg
						width="10"
						height="6"
						viewBox="0 0 10 6"
						fill="none"
						class="shrink-0 transition-transform duration-150 {statusPanelOpen ? 'rotate-180' : ''}"
					>
						<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
				{#if statusPanelOpen}
					<div class="absolute top-full left-0 z-20 mt-1 min-w-60 rounded-md border border-cream-dim bg-white p-2 shadow-lg">
						<label class="flex items-center gap-2 rounded px-2 py-1.5 text-sm font-bold hover:bg-cream-soft">
							<input
								type="checkbox"
								checked={statusFilter.size === QUEUE_STATUSES.length}
								onchange={toggleAllStatuses}
								class="accent-coral"
							/>
							All
						</label>
						<div class="my-1 border-t border-cream-dim"></div>
						{#each QUEUE_STATUSES as s (s)}
							<label class="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-cream-soft">
								<input
									type="checkbox"
									checked={statusFilter.has(s)}
									onchange={() => toggleStatus(s)}
									class="accent-coral"
								/>
								{STATUS_LABELS[s]}
							</label>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-6 overflow-x-auto rounded-md border border-cream-dim bg-white">
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-cream-soft text-left text-xs tracking-wide text-ink/60 uppercase">
						<th class="px-5 py-3 font-bold">List</th>
						<th class="px-5 py-3 font-bold">Prospect</th>
						<th class="px-5 py-3 font-bold">Segment</th>
						<th class="px-5 py-3 font-bold">Match</th>
						<th class="px-5 py-3 font-bold">Status</th>
						<th class="px-5 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredQueueRows as p (p.id)}
						<tr
							onclick={() => openProspect(p.id)}
							class="cursor-pointer border-t border-cream-dim hover:bg-gray-100"
						>
							<td class="px-5 py-4 text-xs text-ink/70">
								{p.source === 'apollo' ? 'Apollo' : 'CSV'}
							</td>
							<td class="px-5 py-4">
								<div class="font-bold text-ink">{p.firstName} {p.lastName}</div>
								<div class="text-xs text-ink/60">{p.title ?? ''}{p.title && p.organization ? ', ' : ''}{p.organization ?? ''}</div>
							</td>
							<td class="px-5 py-4">
								<span class="rounded-full px-2 py-0.5 text-xs font-bold {segmentChipClass(p.segment as TalkTrackSegment)}">
									{segmentLabel(p.segment)}
								</span>
							</td>
							<td class="px-5 py-4 text-xs text-ink/70">
								{p.segmentConfidence != null ? `${Math.round(p.segmentConfidence * 100)}%` : '—'}
							</td>
							<td class="px-5 py-4">
								<span class="rounded-full px-2 py-0.5 text-xs font-bold {statusChipClass(p.status)}">
									{STATUS_LABELS[p.status]}
								</span>
							</td>
							<td class="px-5 py-4 text-right">
								<a
								href={resolve('/prospects/[id]', { id: p.id })}
								onclick={(e) => e.stopPropagation()}
								class="text-xs font-bold text-periwinkle-dark hover:underline"
							>
								Open →
							</a>
							</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-ink/50">No Prospects match these filters.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if tab === 'already-contacted'}
		<div class="relative mt-6">
			<input
				type="text"
				bind:value={contactedSearchQuery}
				placeholder="Search prospects…"
				class="w-full rounded-md border border-cream-dim bg-white px-3 py-2 pr-8 text-sm text-ink placeholder:text-ink/40"
			/>
			{#if contactedSearchQuery}
				<button
					onclick={() => (contactedSearchQuery = '')}
					aria-label="Clear search"
					class="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-ink/40 hover:text-ink"
				>
					×
				</button>
			{/if}
		</div>

		<div class="mt-6 overflow-x-auto rounded-md border border-cream-dim bg-white">
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-cream-soft text-left text-xs tracking-wide text-ink/60 uppercase">
						<th class="px-5 py-3 font-bold">List</th>
						<th class="px-5 py-3 font-bold">Prospect</th>
						<th class="px-5 py-3 font-bold">Segment</th>
						<th class="px-5 py-3 font-bold">Match</th>
						<th class="px-5 py-3 font-bold">Status</th>
						<th class="px-5 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredAlreadyContactedRows as p (p.id)}
						<tr
							onclick={() => openProspect(p.id)}
							class="cursor-pointer border-t border-cream-dim hover:bg-gray-100"
						>
							<td class="px-5 py-4 text-xs text-ink/70">
								{p.source === 'apollo' ? 'Apollo' : 'CSV'}
							</td>
							<td class="px-5 py-4">
								<div class="font-bold text-ink">{p.firstName} {p.lastName}</div>
								<div class="text-xs text-ink/60">{p.title ?? ''}{p.title && p.organization ? ', ' : ''}{p.organization ?? ''}</div>
							</td>
							<td class="px-5 py-4">
								{#if p.priorTalkTrack}
									<span class="rounded-full px-2 py-0.5 text-xs font-bold {segmentChipClass(p.priorTalkTrack)}">
										{segmentLabel(p.priorTalkTrack)}
									</span>
								{:else}
									<span class="text-xs text-ink/50">—</span>
								{/if}
							</td>
							<td class="px-5 py-4 text-xs text-ink/70">
								{p.segmentConfidence != null ? `${Math.round(p.segmentConfidence * 100)}%` : '—'}
							</td>
							<td class="px-5 py-4">
								<span class="rounded-full px-2 py-0.5 text-xs font-bold {statusChipClass(p.status)}">
									{STATUS_LABELS[p.status]}
								</span>
							</td>
							<td class="px-5 py-4 text-right">
								<a
									href={resolve('/prospects/[id]', { id: p.id })}
									onclick={(e) => e.stopPropagation()}
									class="text-xs font-bold text-periwinkle-dark hover:underline"
								>
									Open →
								</a>
							</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-ink/50">No already-contacted prospects.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="relative mt-6">
			<input
				type="text"
				bind:value={unassignedSearchQuery}
				placeholder="Search prospects…"
				class="w-full rounded-md border border-cream-dim bg-white px-3 py-2 pr-8 text-sm text-ink placeholder:text-ink/40"
			/>
			{#if unassignedSearchQuery}
				<button
					onclick={() => (unassignedSearchQuery = '')}
					aria-label="Clear search"
					class="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-ink/40 hover:text-ink"
				>
					×
				</button>
			{/if}
		</div>

		<div class="mt-6 overflow-x-auto rounded-md border border-cream-dim bg-white">
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-cream-soft text-left text-xs tracking-wide text-ink/60 uppercase">
						<th class="px-5 py-3 font-bold">List</th>
						<th class="px-5 py-3 font-bold">Prospect</th>
						<th class="px-5 py-3 font-bold">Segment</th>
						<th class="px-5 py-3 font-bold">Match</th>
						<th class="px-5 py-3 font-bold">Status</th>
						<th class="px-5 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredUnassignedRows as p (p.id)}
						<tr
							onclick={() => openProspect(p.id)}
							class="cursor-pointer border-t border-cream-dim hover:bg-gray-100"
						>
							<td class="px-5 py-4 text-xs text-ink/70">
								{p.source === 'apollo' ? 'Apollo' : 'CSV'}
							</td>
							<td class="px-5 py-4">
								<div class="font-bold text-ink">{p.firstName} {p.lastName}</div>
								<div class="text-xs text-ink/60">{p.title ?? ''}{p.title && p.organization ? ', ' : ''}{p.organization ?? ''}</div>
							</td>
							<td class="px-5 py-4">
								<span class="rounded-full px-2 py-0.5 text-xs font-bold {segmentChipClass(p.segment)}">
									{segmentLabel(p.segment)}
								</span>
							</td>
							<td class="px-5 py-4 text-xs text-ink/70">
								{p.segmentConfidence != null ? `${Math.round(p.segmentConfidence * 100)}%` : '—'}
							</td>
							<td class="px-5 py-4">
								<span class="rounded-full px-2 py-0.5 text-xs font-bold {statusChipClass(p.status)}">
									{STATUS_LABELS[p.status]}
								</span>
							</td>
							<td class="px-5 py-4 text-right">
								<a
									href={resolve('/prospects/[id]', { id: p.id })}
									onclick={(e) => e.stopPropagation()}
									class="text-xs font-bold text-periwinkle-dark hover:underline"
								>
									Open →
								</a>
							</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-ink/50">No unassigned prospects.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
