import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockEnv, setMockEnv } from './test-helpers/mock-env.js';
import { chainable } from './test-helpers/db-chain.js';

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { selectMock, insertMock, updateMock, anthropicCreateMock } = vi.hoisted(() => ({
	selectMock: vi.fn(),
	insertMock: vi.fn(),
	updateMock: vi.fn(),
	anthropicCreateMock: vi.fn()
}));

vi.mock('./db.js', () => ({
	db: { select: selectMock, insert: insertMock, update: updateMock }
}));

vi.mock('@anthropic-ai/sdk', () => ({
	default: class {
		messages = { create: anthropicCreateMock };
	}
}));

import { draftEmails, prospects } from './schema.js';
import { generateDraft } from './draft.js';

const PROSPECT_ROW = {
	id: 'prospect-1',
	firstName: 'Jane',
	lastName: 'Doe',
	title: 'Board Member',
	organization: 'Acme',
	location: 'San Diego',
	email: 'jane@example.com',
	linkedinUrl: null,
	segment: 'board-prospects'
};

function anthropicResponse(text: string) {
	return { content: [{ type: 'text', text }] };
}

const VALID_JSON = JSON.stringify({
	subject: 'Hello',
	body: 'Body text',
	researchSummary: 'Summary',
	researchConfidence: 0.8
});

beforeEach(() => {
	setMockEnv({ ANTHROPIC_API_KEY: 'test-key' });
	selectMock.mockReset();
	insertMock.mockReset();
	updateMock.mockReset();
	anthropicCreateMock.mockReset();
});

describe('generateDraft', () => {
	it('throws when the prospect does not exist', async () => {
		selectMock.mockReturnValue(chainable([]));

		await expect(generateDraft('missing')).rejects.toThrow('Prospect not found');
		expect(anthropicCreateMock).not.toHaveBeenCalled();
	});

	it('throws when the prospect has an unassigned segment', async () => {
		selectMock.mockReturnValue(chainable([{ ...PROSPECT_ROW, segment: 'unassigned' }]));

		await expect(generateDraft('prospect-1')).rejects.toThrow(/unassigned segment/);
		expect(anthropicCreateMock).not.toHaveBeenCalled();
	});

	it('throws when ANTHROPIC_API_KEY is not configured', async () => {
		setMockEnv();
		selectMock.mockReturnValue(chainable([PROSPECT_ROW]));

		await expect(generateDraft('prospect-1')).rejects.toThrow('ANTHROPIC_API_KEY');
		expect(anthropicCreateMock).not.toHaveBeenCalled();
	});

	it('generates and persists a draft, and marks the prospect draft-ready', async () => {
		const selectChain = chainable([PROSPECT_ROW]);
		const insertChain = chainable([{ id: 'draft-1', subject: 'Hello', body: 'Body text' }]);
		const updateChain = chainable(undefined);
		selectMock.mockReturnValue(selectChain);
		insertMock.mockReturnValue(insertChain);
		updateMock.mockReturnValue(updateChain);
		anthropicCreateMock.mockResolvedValue(anthropicResponse(VALID_JSON));

		const draft = await generateDraft('prospect-1');

		expect(draft).toEqual({ id: 'draft-1', subject: 'Hello', body: 'Body text' });
		expect(insertMock).toHaveBeenCalledWith(draftEmails);
		expect(insertChain.values).toHaveBeenCalledWith(
			expect.objectContaining({
				prospectId: 'prospect-1',
				segment: 'board-prospects',
				subject: 'Hello',
				body: 'Body text',
				researchSummary: 'Summary',
				researchConfidence: 0.8,
				approved: false
			})
		);
		expect(updateMock).toHaveBeenCalledWith(prospects);
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'draft-ready' })
		);
		expect(anthropicCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				model: 'claude-haiku-4-5-20251001',
				messages: [
					expect.objectContaining({ role: 'user', content: expect.stringContaining('Jane Doe') })
				]
			})
		);
	});

	it('strips markdown code fencing before parsing the AI response', async () => {
		selectMock.mockReturnValue(chainable([PROSPECT_ROW]));
		insertMock.mockReturnValue(chainable([{ id: 'draft-1' }]));
		updateMock.mockReturnValue(chainable(undefined));
		anthropicCreateMock.mockResolvedValue(anthropicResponse('```json\n' + VALID_JSON + '\n```'));

		await expect(generateDraft('prospect-1')).resolves.toEqual({ id: 'draft-1' });
	});

	it('throws a descriptive error when the AI response is not valid JSON', async () => {
		selectMock.mockReturnValue(chainable([PROSPECT_ROW]));
		anthropicCreateMock.mockResolvedValue(anthropicResponse('not json'));

		await expect(generateDraft('prospect-1')).rejects.toThrow(
			'Failed to parse AI response as JSON'
		);
		expect(insertMock).not.toHaveBeenCalled();
	});

	it('throws a descriptive error when the response has no text content block', async () => {
		selectMock.mockReturnValue(chainable([PROSPECT_ROW]));
		anthropicCreateMock.mockResolvedValue({ content: [{ type: 'tool_use' }] });

		await expect(generateDraft('prospect-1')).rejects.toThrow(
			'Failed to parse AI response as JSON'
		);
	});
});
