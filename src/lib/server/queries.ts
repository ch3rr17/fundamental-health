import { db } from './db.js';
import { draftEmails, prospects } from './schema.js';
import { desc, eq } from 'drizzle-orm';

export async function listProspects() {
	return db.select().from(prospects).orderBy(desc(prospects.updatedAt));
}

export async function getProspectWithDraft(id: string) {
	const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id));
	if (!prospect) return null;

	const [draft] = await db
		.select()
		.from(draftEmails)
		.where(eq(draftEmails.prospectId, id))
		.orderBy(desc(draftEmails.createdAt))
		.limit(1);

	return { prospect, draft: draft ?? null };
}
