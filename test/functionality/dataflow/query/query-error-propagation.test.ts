import { describe, expect, test, vi } from 'vitest';
import { SupportedQueries, executeQueries } from '../../../../src/queries/query';
import { setMinLevelOfAllLogs } from '../../_helper/log';
import { LogLevel } from '../../../../src/util/log';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { DoesCallQuery } from '../../../../src/queries/catalog/does-call-query/does-call-query-format';

/** runs the given queries while keeping the expected error out of the test log */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
	const verbose = process.env['FLOWR_VERBOSE'] === 'true';
	if(!verbose) {
		setMinLevelOfAllLogs(LogLevel.Fatal);
	}
	try {
		return await fn();
	} finally {
		if(!verbose) {
			setMinLevelOfAllLogs(LogLevel.Error);
		}
	}
}

describe('Query API error propagation', () => {
	test('records a failing query with its error instead of swallowing it into an undefined result', async() => {
		// regression: a throwing executor used to become an `undefined` result, which then crashed downstream on
		// `.meta` and hid the cause; it must not throw (other queries keep computing) and must carry the message
		const spy = vi.spyOn(SupportedQueries['config'], 'executor').mockImplementation(() => {
			throw new Error('boom-during-execution');
		});
		const verbose = process.env['FLOWR_VERBOSE'] === 'true';
		if(!verbose) {
			setMinLevelOfAllLogs(LogLevel.Fatal);
		}
		try {
			const res = await executeQueries({ analyzer: undefined } as never, [{ type: 'config' }]);
			expect((res as unknown as Record<string, { error?: string }>).config?.error).toBe('boom-during-execution');
			expect(res['.meta']).toBeDefined();
		} finally {
			spy.mockRestore();
			if(!verbose) {
				setMinLevelOfAllLogs(LogLevel.Error);
			}
		}
	});

	describe('with a real query', withTreeSitter(parser => {
		const code = 'f <- function() { eval(1) }\nf()';
		const valid: DoesCallQuery = { type: 'does-call', queryId: 'valid', call: '2@f', calls: { type: 'name', name: 'eval', nameExact: true } };
		const invalid = { type: 'does-call', queryId: 'invalid', call: '2@f', calls: { type: 'nope' } } as unknown as DoesCallQuery;

		async function query(...queries: readonly DoesCallQuery[]) {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			return (await quietly(() => analyzer.query(queries))) as unknown as Record<string, { results?: Record<string, unknown>, error?: string }>;
		}

		test('one invalid query does not discard its valid siblings', async() => {
			const res = await query(valid, invalid, { ...valid, queryId: 'valid2', call: '1@function' });
			expect(res['does-call'].results).toEqual({ valid: { call: 11 }, valid2: { call: 8 } });
			expect(res['does-call'].error).toBe('Unhandled constraint type {"type":"nope"}');
		});

		test('a batch of valid queries stays free of errors', async() => {
			const res = await query(valid, { ...valid, queryId: 'valid2', call: '1@function' });
			expect(res['does-call'].error).toBeUndefined();
			expect(res['does-call'].results).toEqual({ valid: { call: 11 }, valid2: { call: 8 } });
		});
	}));
});
