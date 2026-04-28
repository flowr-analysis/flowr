import { describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import {
	NumericPentagonInferenceVisitor
} from '../../../../src/abstract-interpretation/pentagon/numeric-pentagon-inference';

describe('Test', () => {
	test('t', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();

		analyzer.addRequest(`
			x <- 1
			y <- x - 1
		`.trim());

		const ast = await analyzer.normalize();
		const dfg = (await analyzer.dataflow()).graph;
		const cfg = await analyzer.controlflow();
		const ctx = analyzer.inspectContext();

		const visitor = new NumericPentagonInferenceVisitor({
			normalizedAst: ast,
			dfg:           dfg,
			controlFlow:   cfg,
			ctx:           ctx
		});

		visitor.start();

		visitor.getAbstractTrace().entries().forEach(([key, value]) =>
			console.log(key, value.toString())
		);
	});
});