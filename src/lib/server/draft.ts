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

// Demo sender until real user accounts exist.
const SENDER_NAME = 'Jordan Lee';

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
- Sign off as ${SENDER_NAME}, Development Associate at FundaMental Health.
- NEVER use en dashes (–) or em dashes (—), and never substitute a hyphen set off with spaces ("word - word") in their place either. Rewrite with a comma or period instead.
- Avoid stock AI-sounding phrasing ("I hope this finds you well," "I wanted to reach out," neatly parallel three-part sentences). Vary sentence length and keep the voice plainspoken, the way a real development associate would actually write.

OUTPUT FORMAT — return valid JSON only, no markdown fencing:
{
  "subject": "email subject line",
  "body": "full email body text",
  "researchSummary": "2-3 sentence summary of what you know about this prospect and why they fit this segment",
  "researchConfidence": 0.0 to 1.0 indicating how much public information was available to personalize with
}`;

// Safety net behind the system prompt's dash instruction: the model occasionally
// slips one in anyway, and an em/en dash is a well-known "this was AI-written" tell.
export function stripDashes(input: string): string {
	let text = input;

	// Digit ranges ("2020–2026", "10 - 15") read fine as a plain hyphen with no spaces,
	// whichever dash character the source used.
	text = text.replace(/(\d)\s*[-–—]\s*(\d)/g, '$1-$2');

	// Everywhere else, a dash is standing in for a comma — setting off a clause, an
	// aside, or an appositive. That holds for en/em dashes, spaced or not ("word — word"
	// and "word—word" mean the same thing), and for a plain hyphen used the same way
	// ("word - word") — a common workaround when told not to use a real dash character.
	// A comma is grammatically safe in every one of those cases, unlike a period, which
	// can turn a noun phrase into a fragment.
	text = text.replace(/\s*[–—]\s*/g, ', ');
	text = text.replace(/ - /g, ', ');

	return text;
}

export async function generateDraft(prospectId: string) {
	const prospect = await db.select().from(prospects).where(eq(prospects.id, prospectId));
	if (prospect.length === 0) {
		throw new Error('Prospect not found');
	}

	const p = prospect[0];

	if (p.segment === 'unassigned') {
		throw new Error(
			'Cannot generate draft for unassigned segment - assign a talk-track segment first'
		);
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
	text = text
		.replace(/^```(?:json)?\s*\n?/i, '')
		.replace(/\n?```\s*$/i, '')
		.trim();

	let parsed: {
		subject: string;
		body: string;
		researchSummary: string;
		researchConfidence: number;
	};
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('Failed to parse AI response as JSON');
	}

	const subject = stripDashes(parsed.subject);
	const body = stripDashes(parsed.body).replaceAll('[Your Name]', SENDER_NAME);

	const [draft] = await db
		.insert(draftEmails)
		.values({
			prospectId: p.id,
			segment,
			subject,
			body,
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
