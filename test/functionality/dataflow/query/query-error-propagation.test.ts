import { describe, expect, test, vi } from 'vitest';
import { SupportedQueries, executeQueries } from '../../../../src/queries/query';

describe('Query API error propagation', () => {
	test('records a failing query with its error instead of swallowing it into an undefined result', async() => {
		// regression: a throwing executor used to become an `undefined` result, which then crashed downstream on
		// `.meta` and hid the cause; it must not throw (other queries keep computing) and must carry the message
		const spy = vi.spyOn(SupportedQueries['config'], 'executor').mockImplementation(() => {
			throw new Error('boom-during-execution');
		});
		try {
			const res = await executeQueries({ analyzer: undefined } as never, [{ type: 'config' }]);
			expect((res as unknown as Record<string, { error?: string }>).config?.error).toBe('boom-during-execution');
			expect(res['.meta']).toBeDefined();
		} finally {
			spy.mockRestore();
		}
	});
});
