import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { analyze } from '../_helper/analyzer';

describe('Derived analyzer values under gas pressure', withTreeSitter(parser => {
	const code = 'x <- url("http://a.b")\ny <- runif(1)\nprint(x)\nprint(y)';
	async function sources(tightFirst: boolean) {
		const analyzer = await analyze(parser, code);
		const query = { type: 'input-sources', criterion: ['3@x', '4@y'] } as const;
		if(tightFirst) {
			await analyzer.query(query, { gas: { linter: { critical: -1, problematic: -1 } } });
		}
		return (await analyzer.query(query)).results;
	}
	test('a query under tight gas does not degrade the shared default config of later queries', async() => {
		assert.deepStrictEqual(await sources(true), await sources(false));
	});
}));
