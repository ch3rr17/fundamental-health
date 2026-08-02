<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { SEGMENT_LABELS, SEGMENT_ORDER, STATUS_LABELS } from '$lib/segments';
	import type { Prospect, DraftEmail, TalkTrackSegment } from '$lib/types';

	let { data } = $props();
	let prospect = $derived(data.prospect as Prospect);
	let draft = $derived(data.draft as DraftEmail | null);

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
				body: JSON.stringify({ status: 'imported' })
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

<div class="mx-auto max-w-5xl px-6 py-12">
	<a href={resolve('/queue')} class="text-xs font-bold text-periwinkle-dark">← Back to Prospects</a>

	<div class="mt-3 flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold text-navy">{prospect.firstName} {prospect.lastName}</h1>
			<p class="mt-1 text-sm text-ink/70">
				{prospect.title ?? ''}{prospect.title && prospect.organization ? ', ' : ''}{prospect.organization ?? ''}
				{prospect.location ? ` · ${prospect.location}` : ''}
			</p>
		</div>
		{#if prospect.segment !== 'unassigned'}
			<span class="rounded-full bg-cream-soft px-3 py-1 text-xs font-bold text-navy">
				{SEGMENT_LABELS[prospect.segment as TalkTrackSegment]}{prospect.segmentConfidence != null
					? ` · ${Math.round(prospect.segmentConfidence * 100)}% match`
					: ''}
			</span>
		{/if}
	</div>

	{#if errorMsg}
		<p class="mt-4 rounded-md bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{errorMsg}</p>
	{/if}

	{#if prospect.status === 'already-contacted'}
		<div class="mt-6 rounded-lg border border-cream-dim bg-white p-6">
			<p class="text-sm text-ink">
				This Prospect matched an existing record
				{prospect.priorTalkTrack ? ` — prior talk track: ${SEGMENT_LABELS[prospect.priorTalkTrack]}` : ''}{prospect.priorContactDate
					? `, contacted ${new Date(prospect.priorContactDate).toLocaleDateString()}`
					: ''}.
			</p>
			<button
				onclick={reapproach}
				disabled={busy}
				class="mt-4 cursor-pointer rounded-md border border-cream-dim px-4 py-2 text-sm font-bold text-ink/70 hover:bg-cream-soft disabled:cursor-not-allowed disabled:opacity-50"
			>
				Re-approach anyway
			</button>
		</div>
	{:else if prospect.segment === 'unassigned'}
		<div class="mt-6 rounded-lg border border-cream-dim bg-white p-6">
			<p class="text-sm text-ink">
				No talk-track segment could be confidently assigned. Tag one manually to continue.
			</p>
			<div class="mt-4 flex items-center gap-3">
				<select
					bind:value={manualSegment}
					class="rounded-md border border-cream-dim px-3 py-2 text-sm font-bold text-ink"
				>
					{#each SEGMENT_ORDER as seg (seg)}
						<option value={seg}>{SEGMENT_LABELS[seg]}</option>
					{/each}
				</select>
				<button
					onclick={assignSegmentManually}
					disabled={busy}
					class="cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-4 py-2 text-sm font-bold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-50"
				>
					Assign
				</button>
			</div>
		</div>
	{:else if !draft}
		<div class="mt-6 rounded-lg border border-cream-dim bg-white p-6 text-center">
			<p class="text-sm text-ink">No draft yet — research and drafting hasn't run for this Prospect.</p>
			<button
				onclick={generateDraft}
				disabled={busy}
				class="mt-4 cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-5 py-3 text-sm font-bold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-50"
			>
				{busy ? 'Researching…' : 'Generate draft'}
			</button>
		</div>
	{:else}
		<div class="mt-6 grid grid-cols-1 gap-4 {draft.researchSummary ? 'md:grid-cols-[280px_1fr]' : ''}">
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
						rows="8"
						class="w-full px-4 py-3 text-sm text-ink"
					></textarea>
					<div class="flex justify-end gap-2 border-t border-cream-dim px-4 py-3">
						<button
							onclick={() => (editing = false)}
							class="cursor-pointer rounded-md border border-cream-dim px-4 py-2 text-sm font-bold text-ink/70"
						>
							Cancel
						</button>
						<button
							onclick={saveEdit}
							disabled={busy}
							class="cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-4 py-2 text-sm font-bold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-50"
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
				{pushResult.status === 'send-confirmed' ? 'Sent — confirmed.' : (pushResult.message ?? 'Pushed, send unconfirmed — check Klaviyo.')}
			</div>
		{/if}

		{#if !draft.approved && !editing}
			<div class="mt-4 flex justify-end gap-2">
				<a
					href={resolve('/queue')}
					class="rounded-md border border-cream-dim px-4 py-3 text-sm font-bold text-ink/70 hover:bg-cream-soft"
				>
					Cancel
				</a>
				<button
					onclick={startEdit}
					disabled={busy}
					class="cursor-pointer rounded-md border border-cream-dim px-4 py-3 text-sm font-bold text-ink/70 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Edit
				</button>
				<button
					onclick={approveAndPush}
					disabled={busy}
					class="cursor-pointer rounded-md bg-linear-to-r from-coral to-amber px-5 py-3 text-sm font-bold tracking-wide text-white uppercase disabled:cursor-not-allowed disabled:opacity-50"
				>
					{busy ? 'Confirming send…' : 'Approve & push'}
				</button>
			</div>
		{:else if draft.approved}
			<p class="mt-4 text-right text-xs font-bold text-ink/50">
				Approved{prospect.status ? ` — ${STATUS_LABELS[prospect.status]}` : ''}
			</p>
		{/if}
	{/if}
</div>
