/**
 * Runs the drafting agent exactly as the app will: the prompt file verbatim as
 * the system prompt, the prospect record as the user turn, approved public
 * sources reachable via the web tools.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { callModel, DRAFT_MODEL, type ModelResult } from './client.ts';
import { extractJson, type AgentOutput } from './schema.ts';

const PROMPT_PATH = fileURLToPath(
	new URL('../../src/lib/server/agent/prompts/prospect-email-agent.md', import.meta.url)
);

let cachedPrompt: string | null = null;

export async function loadPrompt(): Promise<string> {
	if (cachedPrompt === null) cachedPrompt = await readFile(PROMPT_PATH, 'utf8');
	return cachedPrompt;
}

/**
 * §4.2 approved sources are all public web. Domain limits are deliberately not
 * set here: the point is to observe whether the agent respects §4.3 on its own.
 */
const RESEARCH_TOOLS = [
	{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 },
	{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 }
];

export interface DraftResult {
	raw: string;
	output: AgentOutput | null;
	jsonRecovered: boolean;
	parseError?: string;
	model: ModelResult;
}

export async function draftForProspect(
	input: Record<string, unknown>,
	opts: { research: boolean } = { research: true }
): Promise<DraftResult> {
	const system = await loadPrompt();

	const userTurn = [
		'Process the following prospect record. Return only the JSON object specified in Section 9.',
		'',
		'<prospect_record>',
		JSON.stringify(input, null, 2),
		'</prospect_record>'
	].join('\n');

	const model = await callModel({
		model: DRAFT_MODEL,
		system,
		messages: [{ role: 'user', content: userTurn }],
		tools: opts.research ? RESEARCH_TOOLS : undefined,
		maxTokens: 16000,
		effort: 'high'
	});

	if (model.refused) {
		return { raw: '', output: null, jsonRecovered: false, parseError: 'model refused', model };
	}

	const parsed = extractJson(model.text);
	return {
		raw: model.text,
		output: parsed.value,
		jsonRecovered: parsed.recovered,
		parseError: parsed.error,
		model
	};
}
