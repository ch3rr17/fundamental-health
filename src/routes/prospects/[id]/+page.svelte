<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { SEGMENT_LABELS, SEGMENT_ORDER, STATUS_LABELS } from '$lib/segments';
	import type { Prospect, DraftEmail, TalkTrackSegment } from '$lib/types';

	let { data } = $props();
	let prospect = $derived(data.prospect as Prospect);
	let draft = $derived(data.draft as DraftEmail | null);

	function statusChipClass(status: Prospect['status']) {
		if (status === 'send-confirmed' || status === 'logged') return 'bg-sky text-periwinkle-dark';
		if (status === 'approved' || status === 'pushed') return 'bg-amber/20 text-amber';
		if (status === 'draft-ready') return 'bg-navy/10 text-navy';
		return 'bg-cream-dim text-ink/70';
	}

	const FROM_OPTIONS = [
		'hello@fundamental.health',
		'development@fundamental.health',
		'fundamentalhealthdonor@gmail.com'
	];

	let fromEmail = $state(FROM_OPTIONS[0]);
	let editing = $state(false);
	let editSubject = $state('');
	let editBody = $state('');
	let busy = $state(false);
	let errorMsg = $state('');
	let pushResult = $state<{ status: string; message?: string } | null>(null);
	let manualSegment = $state<TalkTrackSegment>('community-donors');

	function startEdit() {
		if (!draft) return;
		editSubject = draft.subject;
		editBody = draft.body;
		editing = true;
	}

	async function saveEdit() {
		if (!draft) return;
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch(`/api/drafts/${draft.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ subject: editSubject, body: editBody })
			});
			if (!res.ok) {
				const d = await res.json();
				errorMsg = d.error ?? 'Save failed';
				return;
			}
			editing = false;
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	async function generateDraft() {
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/drafts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ prospectId: prospect.id })
			});
			const d = await res.json();
			if (!res.ok) {
				errorMsg = d.error ?? 'Draft generation failed';
				return;
			}
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	async function approveAndPush() {
		if (!draft) return;
		busy = true;
		errorMsg = '';
		pushResult = null;
		try {
			const approveRes = await fetch(`/api/drafts/${draft.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ approved: true })
			});
			if (!approveRes.ok) {
				const d = await approveRes.json();
				errorMsg = d.error ?? 'Approve failed';
				return;
			}

			const pushRes = await fetch(`/api/prospects/${prospect.id}/push`, { method: 'POST' });
			const pushData = await pushRes.json();
			if (!pushRes.ok) {
				errorMsg = pushData.error ?? 'Push failed';
				return;
			}
			pushResult = pushData;
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	async function assignSegmentManually() {
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch(`/api/prospects/${prospect.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ segment: manualSegment, segmentConfidence: 1 })
			});
			if (!res.ok) {
				const d = await res.json();
				errorMsg = d.error ?? 'Failed to assign segment';
				return;
			}
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	async function reapproach() {
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch(`/api/prospects/${prospect.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ status: 'imported', segment: manualSegment, segmentConfidence: 1 })
			});
			if (!res.ok) {
				const d = await res.json();
				errorMsg = d.error ?? 'Failed';
				return;
			}
			await invalidateAll();
		} finally {
			busy = false;
		}
	}
</script>

<div class="mx-auto max-w-6xl px-6 py-12">
	<a href={resolve('/prospects')} class="text-xs font-bold text-periwinkle-dark hover:underline">← Back to Prospects</a>

	{#if errorMsg}
		<p class="mt-4 rounded-md bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{errorMsg}</p>
	{/if}

	{#if prospect.status === 'already-contacted'}
		<div class="mt-8 flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold text-navy">{prospect.firstName} {prospect.lastName}</h1>
				<p class="mt-2 text-sm text-ink/70">
					{prospect.title ?? ''}{prospect.title && prospect.organization ? ', ' : ''}{prospect.organization ?? ''}
					{prospect.location ? ` · ${prospect.location}` : ''}
				</p>
				<div class="mt-3 flex items-center gap-2">
					<span class="shrink-0 whitespace-nowrap rounded-full bg-cream-soft px-3 py-1 text-xs font-bold text-navy">
						{prospect.priorTalkTrack ? SEGMENT_LABELS[prospect.priorTalkTrack] : 'Unassigned'}
					</span>
				</div>
				<p class="mt-2 text-xs text-ink/50">
					{prospect.priorContactDate
						? `Previously contacted ${new Date(prospect.priorContactDate).toLocaleDateString()}`
						: 'Prior contact date unknown'}
				</p>
			</div>
			<span class="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold {statusChipClass(prospect.status)}">
				{STATUS_LABELS[prospect.status]}
			</span>
		</div>
		<hr class="mt-8 border-cream-dim" />
		<div class="mt-8 flex items-end gap-3">
				<div>
					<label for="manual-segment" class="mb-2 block text-xs font-bold tracking-wide text-ink/60 uppercase">
						Choose new segment
					</label>
					<select
						id="manual-segment"
						bind:value={manualSegment}
						class="rounded-md border border-cream-dim px-3 py-2 text-sm font-bold text-ink"
					>
						{#each SEGMENT_ORDER as seg (seg)}
							<option value={seg} disabled={seg === prospect.priorTalkTrack}>{SEGMENT_LABELS[seg]}</option>
						{/each}
					</select>
				</div>
				<button
					onclick={reapproach}
					disabled={busy}
					class="cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-3 py-2 text-xs font-bold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-50"
				>
				{busy ? 'Re-approaching…' : 'Research and Draft Email'}
			</button>
		</div>

		<div class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
			<div class="rounded-lg border border-cream-dim bg-white p-5">
				<h2 class="text-xs font-bold tracking-wide text-ink/60 uppercase">Research summary</h2>
				<p class="mt-2 text-sm text-ink/50">Research hasn't run yet.</p>
			</div>

			<div class="overflow-hidden rounded-lg border border-cream-dim bg-white">
				<div class="flex items-center gap-2 border-b border-cream-dim px-4 py-3 text-sm">
					<span class="w-12 shrink-0 text-xs font-bold tracking-wide text-ink/60 uppercase">From</span>
					<span class="text-ink/40">—</span>
				</div>
				<div class="flex items-center gap-2 border-b border-cream-dim px-4 py-3 text-sm">
					<span class="w-12 shrink-0 text-xs font-bold tracking-wide text-ink/60 uppercase">To</span>
					<span class="text-ink">{prospect.email ?? '—'}</span>
				</div>
				<div class="px-4 py-12 text-center text-sm text-ink/50">Email hasn't been drafted yet.</div>
			</div>
		</div>
	{:else if prospect.segment === 'unassigned'}
		<div class="mt-8 flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold text-navy">{prospect.firstName} {prospect.lastName}</h1>
				<p class="mt-2 text-sm text-ink/70">
					{prospect.title ?? ''}{prospect.title && prospect.organization ? ', ' : ''}{prospect.organization ?? ''}
					{prospect.location ? ` · ${prospect.location}` : ''}
				</p>
				<div class="mt-3 flex items-center gap-2">
					<span class="shrink-0 whitespace-nowrap rounded-full bg-cream-soft px-3 py-1 text-xs font-bold text-navy">Unassigned</span>
				</div>
			</div>
			<span class="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold {statusChipClass(prospect.status)}">
				{STATUS_LABELS[prospect.status]}
			</span>
		</div>
		<hr class="mt-8 border-cream-dim" />
		<div class="mt-8 flex items-end gap-3">
				<div>
					<label for="manual-segment" class="mb-2 block text-xs font-bold tracking-wide text-ink/60 uppercase">
						Assign Segment
					</label>
					<select
						id="manual-segment"
						bind:value={manualSegment}
						class="rounded-md border border-cream-dim px-3 py-2 text-sm font-bold text-ink"
					>
						{#each SEGMENT_ORDER as seg (seg)}
							<option value={seg}>{SEGMENT_LABELS[seg]}</option>
						{/each}
					</select>
				</div>
				<button
					onclick={assignSegmentManually}
					disabled={busy}
					class="cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-3 py-2 text-xs font-bold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-50"
				>
				Research and Draft Email
			</button>
		</div>

		<div class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
			<div class="rounded-lg border border-cream-dim bg-white p-5">
				<h2 class="text-xs font-bold tracking-wide text-ink/60 uppercase">Research summary</h2>
				<p class="mt-2 text-sm text-ink/50">Research hasn't run yet.</p>
			</div>

			<div class="overflow-hidden rounded-lg border border-cream-dim bg-white">
				<div class="flex items-center gap-2 border-b border-cream-dim px-4 py-3 text-sm">
					<span class="w-12 shrink-0 text-xs font-bold tracking-wide text-ink/60 uppercase">From</span>
					<span class="text-ink/40">—</span>
				</div>
				<div class="flex items-center gap-2 border-b border-cream-dim px-4 py-3 text-sm">
					<span class="w-12 shrink-0 text-xs font-bold tracking-wide text-ink/60 uppercase">To</span>
					<span class="text-ink">{prospect.email ?? '—'}</span>
				</div>
				<div class="px-4 py-12 text-center text-sm text-ink/50">Email hasn't been drafted yet.</div>
			</div>
		</div>
	{:else if !draft}
		<div class="mt-8 flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold text-navy">{prospect.firstName} {prospect.lastName}</h1>
				<p class="mt-2 text-sm text-ink/70">
					{prospect.title ?? ''}{prospect.title && prospect.organization ? ', ' : ''}{prospect.organization ?? ''}
					{prospect.location ? ` · ${prospect.location}` : ''}
				</p>
				<div class="mt-3 flex items-center gap-2">
					<span class="shrink-0 whitespace-nowrap rounded-full bg-cream-soft px-3 py-1 text-xs font-bold text-navy">
						{SEGMENT_LABELS[prospect.segment as TalkTrackSegment]}
					</span>
					<span class="shrink-0 whitespace-nowrap rounded-full border border-cream-dim px-3 py-1 text-xs font-bold text-ink/70">
						{prospect.segmentConfidence != null ? `${Math.round(prospect.segmentConfidence * 100)}% match` : '—'}
					</span>
				</div>
			</div>
			<span class="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold {statusChipClass(prospect.status)}">
				{STATUS_LABELS[prospect.status]}
			</span>
		</div>
		<hr class="mt-8 border-cream-dim" />
		<div class="mt-6">
				<button
					onclick={generateDraft}
					disabled={busy}
					class="cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-3 py-2 text-xs font-bold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-50"
				>
				{busy ? 'Researching…' : 'Research and Draft Email'}
			</button>
		</div>

		<div class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
			<div class="rounded-lg border border-cream-dim bg-white p-5">
				<h2 class="text-xs font-bold tracking-wide text-ink/60 uppercase">Research summary</h2>
				<p class="mt-2 text-sm text-ink/50">Research hasn't run yet.</p>
			</div>

			<div class="overflow-hidden rounded-lg border border-cream-dim bg-white">
				<div class="flex items-center gap-2 border-b border-cream-dim px-4 py-3 text-sm">
					<span class="w-12 shrink-0 text-xs font-bold tracking-wide text-ink/60 uppercase">From</span>
					<span class="text-ink/40">—</span>
				</div>
				<div class="flex items-center gap-2 border-b border-cream-dim px-4 py-3 text-sm">
					<span class="w-12 shrink-0 text-xs font-bold tracking-wide text-ink/60 uppercase">To</span>
					<span class="text-ink">{prospect.email ?? '—'}</span>
				</div>
				<div class="px-4 py-12 text-center text-sm text-ink/50">Email hasn't been drafted yet.</div>
			</div>
		</div>
	{:else}
		<div class="mt-8 flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold text-navy">{prospect.firstName} {prospect.lastName}</h1>
				<p class="mt-2 text-sm text-ink/70">
					{prospect.title ?? ''}{prospect.title && prospect.organization ? ', ' : ''}{prospect.organization ?? ''}
					{prospect.location ? ` · ${prospect.location}` : ''}
				</p>
				<div class="mt-3 flex items-center gap-2">
					<span class="shrink-0 whitespace-nowrap rounded-full bg-cream-soft px-3 py-1 text-xs font-bold text-navy">
						{SEGMENT_LABELS[prospect.segment]}
					</span>
					<span class="shrink-0 whitespace-nowrap rounded-full border border-cream-dim px-3 py-1 text-xs font-bold text-ink/70">
						{prospect.segmentConfidence != null ? `${Math.round(prospect.segmentConfidence * 100)}% match` : '—'}
					</span>
				</div>
			</div>
			<span class="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold {statusChipClass(prospect.status)}">
				{STATUS_LABELS[prospect.status]}
			</span>
		</div>
		<hr class="mt-8 border-cream-dim" />
		<div class="mt-8 grid grid-cols-1 gap-6 {draft.researchSummary ? 'md:grid-cols-[280px_1fr]' : ''}">
			{#if draft.researchSummary}
				<div class="rounded-lg border border-cream-dim bg-white p-5">
					<h2 class="text-xs font-bold tracking-wide text-ink/60 uppercase">Research summary</h2>
					<p class="mt-2 text-sm text-ink">{draft.researchSummary}</p>
					{#if draft.researchConfidence != null}
						<p class="mt-2 text-xs text-ink/50">
							Research confidence: {Math.round(draft.researchConfidence * 100)}%
						</p>
					{/if}
				</div>
			{/if}

			<div class="overflow-hidden rounded-lg border border-cream-dim bg-white">
				<div class="flex items-center gap-2 border-b border-cream-dim px-4 py-2 text-sm">
					<span class="w-12 shrink-0 text-xs font-bold tracking-wide text-ink/60 uppercase">From</span>
					{#if draft.approved}
						<span class="text-ink">{fromEmail}</span>
					{:else}
						<select bind:value={fromEmail} class="flex-1 bg-transparent text-sm font-bold text-ink">
							{#each FROM_OPTIONS as opt (opt)}
								<option value={opt}>{opt}</option>
							{/each}
						</select>
					{/if}
				</div>
				<div class="flex items-center gap-2 border-b border-cream-dim px-4 py-2 text-sm">
					<span class="w-12 shrink-0 text-xs font-bold tracking-wide text-ink/60 uppercase">To</span>
					<span class="text-ink">{prospect.email ?? '—'}</span>
				</div>

				{#if editing}
					<input
						bind:value={editSubject}
						class="w-full border-b border-cream-dim bg-cream-soft px-4 py-3 text-sm font-bold text-ink"
					/>
					<textarea
						bind:value={editBody}
						class="field-sizing-content w-full resize-y px-4 py-3 text-sm text-ink"
					></textarea>
					<div class="flex justify-end gap-2 border-t border-cream-dim px-4 py-3">
						<button
							onclick={() => (editing = false)}
							class="cursor-pointer rounded-md border border-cream-dim px-3 py-2 text-xs font-bold text-ink/70"
						>
							Cancel
						</button>
						<button
							onclick={saveEdit}
							disabled={busy}
							class="cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-3 py-2 text-xs font-bold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-50"
						>
							Save
						</button>
					</div>
				{:else}
					<div class="bg-cream-soft px-4 py-3 text-sm font-bold text-ink">{draft.subject}</div>
					<div class="whitespace-pre-wrap px-4 py-4 text-sm text-ink">{draft.body}</div>
				{/if}
			</div>
		</div>

		{#if pushResult}
			<div
				class="mt-4 rounded-md px-4 py-3 text-sm font-bold {pushResult.status === 'send-confirmed'
					? 'bg-sky text-periwinkle-dark'
					: 'bg-amber/20 text-amber'}"
			>
				{pushResult.status === 'send-confirmed' ? 'Sent - confirmed.' : (pushResult.message ?? 'Pushed, send unconfirmed - check Klaviyo.')}
			</div>
		{/if}

		{#if !draft.approved && !editing}
			<div class="mt-6 flex justify-end gap-2">
				{#if !busy}
					<button
						onclick={startEdit}
						class="cursor-pointer rounded-md border border-cream-dim px-3 py-2 text-xs font-bold text-ink/70"
					>
						Edit Email
					</button>
				{/if}
				<button
					onclick={approveAndPush}
					disabled={busy}
					class="cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-3 py-2 text-xs font-bold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-50"
				>
					{busy ? 'Confirming send…' : 'Approve and Send'}
				</button>
			</div>
		{:else if draft.approved}
			<p class="mt-6 text-right text-xs font-bold text-ink/50">
				Approved{prospect.status ? ` - ${STATUS_LABELS[prospect.status]}` : ''}
			</p>
		{/if}
	{/if}
</div>
