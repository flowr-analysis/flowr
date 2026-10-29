import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';

describe('Analyzer', withTreeSitter(parser => {
	test(label('asking for several steps at once runs the tape once', ['name-normal', 'numbers'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(requestFromInput('x <- 1\ny <- x + 1\nprint(y)'));
		const [dataflow, normalize, parse] = await Promise.all([analyzer.dataflow(), analyzer.normalize(), analyzer.parse(), analyzer.dataflow(), analyzer.normalize()]);
		assert.isDefined(parse);
		assert.strictEqual(normalize, await analyzer.normalize());
		assert.strictEqual(dataflow, await analyzer.dataflow());
	});
}));
