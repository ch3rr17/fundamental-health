import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { db } from './db.js';
import { draftEmails, prospects } from './schema.js';
import { eq } from 'drizzle-orm';
import { TALK_TRACKS } from './talk-tracks.js';
import type { TalkTrackSegment } from '$lib/types.js';

function getClient() {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY environment variable is required');
	}
	return new Anthropic({ apiKey });
}

const SYSTEM_PROMPT = `You are a fundraising outreach assistant for FundaMental Health, a San Diego nonprofit that provides mental health services to underserved communities through its Neighbors in Need program.

Your job is to draft a personalized outreach email for a prospect based on:
1. The prospect's profile information (name, title, org, location)
2. The assigned talk-track segment and its messaging guide

STRICT RULES — follow these exactly:
- Use ONLY the information provided in the prospect profile. Do NOT fabricate or assume any details about the prospect.
- If you are uncertain about a detail, OMIT it rather than guess. Say less, not more.
- The email should feel personal and human, not templated.
- Keep it concise — 150-250 words for the body.
- Use the talk-track framing and CTA provided, adapted naturally to the prospect.
- Do NOT mention that you are an AI or that this was auto-generated.
- Sign off as the Development Associate at FundaMental Health (leave the name as [Your Name] for the intern to fill in).

OUTPUT FORMAT — return valid JSON only, no markdown fencing:
{
  "subject": "email subject line",
  "body": "full email body text",
  "researchSummary": "2-3 sentence summary of what you know about this prospect and why they fit this segment",
  "researchConfidence": 0.0 to 1.0 indicating how much public information was available to personalize with
}`;

export async function generateDraft(prospectId: string) {
	const prospect = await db.select().from(prospects).where(eq(prospects.id, prospectId));
	if (prospect.length === 0) {
		throw new Error('Prospect not found');
	}

	const p = prospect[0];

	if (p.segment === 'unassigned') {
		throw new Error('Cannot generate draft for unassigned segment — assign a talk-track segment first');
	}

	const segment = p.segment as TalkTrackSegment;
	const track = TALK_TRACKS[segment];

	const client = getClient();

	const userPrompt = `Draft a personalized outreach email for this prospect:

PROSPECT PROFILE:
- Name: ${p.firstName} ${p.lastName}
- Title: ${p.title ?? 'Unknown'}
- Organization: ${p.organization ?? 'Unknown'}
- Location: ${p.location ?? 'Unknown'}
- Email: ${p.email ?? 'Unknown'}
- LinkedIn: ${p.linkedinUrl ?? 'Not available'}

TALK-TRACK SEGMENT: ${track.label}
FRAMING: ${track.framing}
CTA: ${track.cta}

Generate the email now. Return valid JSON only.`;

	const response = await client.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 1024,
		system: SYSTEM_PROMPT,
		messages: [{ role: 'user', content: userPrompt }]
	});

	let text = response.content[0].type === 'text' ? response.content[0].text : '';

	// Strip markdown fencing if the model wraps the JSON
	text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

	let parsed: { subject: string; body: string; researchSummary: string; researchConfidence: number };
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('Failed to parse AI response as JSON');
	}

	const [draft] = await db
		.insert(draftEmails)
		.values({
			prospectId: p.id,
			segment,
			subject: parsed.subject,
			body: parsed.body,
			researchSummary: parsed.researchSummary,
			researchConfidence: parsed.researchConfidence,
			approved: false
		})
		.returning();

	await db
		.update(prospects)
		.set({ status: 'draft-ready', updatedAt: new Date().toISOString() })
		.where(eq(prospects.id, p.id));

	return draft;
}
