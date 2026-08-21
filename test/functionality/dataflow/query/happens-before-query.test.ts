import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { asciiSummaryOfQueryResult } from '../../../../src/queries/query-print';
import { ansiFormatter } from '../../../../src/util/text/ansi';
import { HappensBeforeKey } from '../../../../src/queries/catalog/happens-before-query/happens-before-query-format';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';

describe('Happens-Before Query', withTreeSitter(parser => {
	const query = [{ type: 'happens-before', a: '1@x', b: '2@y' }] as const;

	test(label('the answer is keyed by the two criteria', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest('x <- 1\ny <- 2');
		const results = await analyzer.query(query as never);
		assert.deepStrictEqual(Object.keys(results['happens-before'].results), [HappensBeforeKey.of('1@x', '2@y')]);
	});

	/* the summary reads the key back, so the two have to spell it the same way */
	test(label('and the summary names them again', ['name-normal'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest('x <- 1\ny <- 2');
		const results = await analyzer.query(query as never);
		const summary = await asciiSummaryOfQueryResult(ansiFormatter, 0, results, analyzer, query as never);
		assert.include(summary, '1@x');
		assert.include(summary, '2@y');
	});
}));
