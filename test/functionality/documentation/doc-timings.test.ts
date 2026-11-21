import { assert, describe, test } from 'vitest';
import { withoutTimings } from '../../../src/documentation/doc-util/doc-timings';

describe('timings in generated pages', () => {
	test('a markdown line break stays only when a line follows it', () => {
		assert.strictEqual(
			withoutTimings('Query: **linter** (8 ms)\\\n   ╰ no findings\\\nAll queries together required ≈8 ms (1ms accuracy, total 9 ms)\n\nnext'),
			'Query: **linter**\\\n   ╰ no findings\n\nnext'
		);
	});
});
