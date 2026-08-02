import { vi } from 'vitest';

/**
 * Minimal stand-in for a drizzle query-builder chain (db.select/insert/update).
 * Every link (from, where, values, set, returning, innerJoin) returns the
 * same chainable object, and the object itself is thenable, so it resolves
 * to `value` whether the caller awaits mid-chain or after `.returning()`.
 */
export function chainable<T>(value: T) {
	const chain: Record<string, unknown> = {};
	for (const method of ['from', 'where', 'values', 'set', 'returning', 'innerJoin']) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (onFulfilled?: (v: T) => unknown, onRejected?: (e: unknown) => unknown) =>
		Promise.resolve(value).then(onFulfilled, onRejected);
	return chain as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<T>;
}
