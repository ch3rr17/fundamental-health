import { pgTable, text, real, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';

export const prospects = pgTable('prospects', {
	id: uuid('id').primaryKey().defaultRandom(),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	email: text('email'),
	organization: text('organization'),
	title: text('title'),
	linkedinUrl: text('linkedin_url'),
	location: text('location'),
	source: text('source', { enum: ['apollo', 'csv'] }).notNull(),
	segment: text('segment', {
		enum: [
			'community-donors',
			'nonprofit-marketing',
			'board-prospects',
			'financial-cra',
			'daf-giving-circles',
			'unassigned'
		]
	})
		.notNull()
		.default('unassigned'),
	segmentConfidence: real('segment_confidence'),
	status: text('status', {
		enum: [
			'imported',
			'already-contacted',
			'needs-review',
			'draft-ready',
			'approved',
			'pushed',
			'send-confirmed',
			'logged'
		]
	})
		.notNull()
		.default('imported'),
	priorContactDate: timestamp('prior_contact_date', { mode: 'string' }),
	priorTalkTrack: text('prior_talk_track', {
		enum: [
			'community-donors',
			'nonprofit-marketing',
			'board-prospects',
			'financial-cra',
			'daf-giving-circles'
		]
	}),
	createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow()
});

export const draftEmails = pgTable('draft_emails', {
	id: uuid('id').primaryKey().defaultRandom(),
	prospectId: uuid('prospect_id')
		.notNull()
		.references(() => prospects.id),
	segment: text('segment', {
		enum: [
			'community-donors',
			'nonprofit-marketing',
			'board-prospects',
			'financial-cra',
			'daf-giving-circles'
		]
	}).notNull(),
	subject: text('subject').notNull(),
	body: text('body').notNull(),
	researchSummary: text('research_summary'),
	researchConfidence: real('research_confidence'),
	approved: boolean('approved').notNull().default(false),
	createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow()
});
