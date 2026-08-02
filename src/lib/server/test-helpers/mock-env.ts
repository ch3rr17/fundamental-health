/**
 * Shared stand-in for `$env/dynamic/private` in server tests.
 *
 * `vi.mock` is per-file and hoisted, so each test file still registers the mock itself:
 *
 *     import { mockEnv, setMockEnv } from './test-helpers/mock-env.js';
 *     vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));
 */
export const mockEnv: Record<string, string | undefined> = {};

/**
 * Replace the mocked env with `env` (empty by default).
 * Mutates in place so modules holding a reference to `mockEnv` stay in sync.
 */
export function setMockEnv(env: Record<string, string | undefined> = {}): void {
	for (const key of Object.keys(mockEnv)) delete mockEnv[key];
	Object.assign(mockEnv, env);
}
