/**
 * Shared copy for the needs-review acknowledgment gate enforced by all three write
 * paths to prospects.status: draft generation (draft.ts), draft approval
 * (api/drafts/[id]), and direct status edits (api/prospects/[id]).
 */
export function needsReviewMessage(action: string): string {
	return `This prospect is flagged for review (possible prompt injection in the imported data). Acknowledge the review before ${action}.`;
}
