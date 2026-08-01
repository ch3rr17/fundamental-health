/**
 * Thin wrapper over the Anthropic SDK for the eval harness.
 *
 * Two things it exists to get right:
 *  1. `stop_reason: "refusal"` is checked before any content is read.
 *  2. Server-side refusal fallbacks are on by default, and the harness degrades
 *     cleanly if the account does not have that beta enabled rather than dying.
 */

import Anthropic from '@anthropic-ai/sdk';

export const DRAFT_MODEL = process.env.EVAL_DRAFT_MODEL ?? 'claude-opus-5';
export const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? 'claude-opus-5';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let fallbacksAvailable = process.env.EVAL_DISABLE_FALLBACKS !== '1';

export const client = new Anthropic();

export interface ModelCall {
	model: string;
	system: string;
	messages: Anthropic.MessageParam[];
	maxTokens?: number;
	effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
	/** Raw server-tool definitions, e.g. web search / web fetch. */
	tools?: unknown[];
	/** A JSON Schema to constrain the response shape. Omit when tools are used. */
	jsonSchema?: Record<string, unknown>;
}

export interface ModelResult {
	text: string;
	stopReason: string | null;
	refused: boolean;
	refusalCategory?: string | null;
	servedBy: string;
	usage: { input: number; output: number };
}

function buildParams(call: ModelCall, withFallbacks: boolean): Record<string, unknown> {
	const outputConfig: Record<string, unknown> = { effort: call.effort ?? 'high' };
	if (call.jsonSchema) {
		outputConfig.format = { type: 'json_schema', schema: call.jsonSchema };
	}

	const params: Record<string, unknown> = {
		model: call.model,
		max_tokens: call.maxTokens ?? 16000,
		system: call.system,
		messages: call.messages,
		output_config: outputConfig
	};

	if (call.tools?.length) params.tools = call.tools;

	if (withFallbacks) {
		params.betas = [FALLBACK_BETA];
		params.fallbacks = 'default';
	}

	return params;
}

function textOf(content: unknown[]): string {
	return content
		.filter(
			(b): b is { type: 'text'; text: string } =>
				typeof b === 'object' && b !== null && (b as { type?: string }).type === 'text'
		)
		.map((b) => b.text)
		.join('\n')
		.trim();
}

function looksLikeBetaRejection(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	return /fallback|beta/i.test(msg);
}

export async function callModel(call: ModelCall): Promise<ModelResult> {
	const attempt = async (withFallbacks: boolean) => {
		const params = buildParams(call, withFallbacks);
		// SDK typings lag the fallbacks beta and raw server-tool shapes.
		const api = withFallbacks
			? (client.beta.messages.create as unknown as (p: unknown) => Promise<unknown>)
			: (client.messages.create as unknown as (p: unknown) => Promise<unknown>);
		return (await api(params)) as {
			content: unknown[];
			stop_reason: string | null;
			stop_details?: { category?: string | null } | null;
			model: string;
			usage: { input_tokens: number; output_tokens: number };
		};
	};

	let response;
	try {
		response = await attempt(fallbacksAvailable);
	} catch (err) {
		if (
			fallbacksAvailable &&
			err instanceof Anthropic.BadRequestError &&
			looksLikeBetaRejection(err)
		) {
			console.warn(
				`  ! server-side fallbacks unavailable on this account (${err.message.slice(0, 120)}); continuing without them`
			);
			fallbacksAvailable = false;
			response = await attempt(false);
		} else {
			throw err;
		}
	}

	// Always before reading content.
	if (response.stop_reason === 'refusal') {
		return {
			text: '',
			stopReason: 'refusal',
			refused: true,
			refusalCategory: response.stop_details?.category ?? null,
			servedBy: response.model,
			usage: { input: response.usage.input_tokens, output: response.usage.output_tokens }
		};
	}

	return {
		text: textOf(response.content),
		stopReason: response.stop_reason,
		refused: false,
		servedBy: response.model,
		usage: { input: response.usage.input_tokens, output: response.usage.output_tokens }
	};
}
