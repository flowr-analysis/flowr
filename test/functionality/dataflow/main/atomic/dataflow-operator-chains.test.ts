import { describe, expect, test } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { label } from '../../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { VertexType } from '../../../../../src/dataflow/graph/vertex';
import { Identifier } from '../../../../../src/dataflow/environments/identifier';

/**
 * `a + b - c`, `a %>% f() %>% g()` and friends nest on their left operand, so they are folded with an explicit
 * spine walk instead of recursing once per nesting level. The fold treats every chain node the same regardless
 * of which operator it carries, so these check it stays faithful across mixed operators and precedences.
 */
describe('Left-associative operator chains', withTreeSitter(ts => {
	const opts = { expectIsSubgraph: true, resolveIdsAsCriterion: true } as const;

	assertDataflow(label('a chain mixing + and - reads every operand', ['binary-operator', 'operators', 'name-normal']), ts,
		'a <- 1\nb <- 2\nc <- 3\nd <- 4\na + b - c + d',
		emptyGraph()
			.addEdge('5@a', '1@a', EdgeType.Reads)
			.addEdge('5@b', '2@b', EdgeType.Reads)
			.addEdge('5@c', '3@c', EdgeType.Reads)
			.addEdge('5@d', '4@d', EdgeType.Reads),
		opts);

	// `*` and `/` bind tighter than `+`/`-`, so the spine is only `((a + (b * c)) - (d / e))`: the fold must not
	// flatten the higher-precedence operands into it
	assertDataflow(label('a chain mixing precedences reads every operand', ['binary-operator', 'operators', 'name-normal']), ts,
		'a <- 1\nb <- 2\nc <- 3\nd <- 4\ne <- 5\na + b * c - d / e',
		emptyGraph()
			.addEdge('6@a', '1@a', EdgeType.Reads)
			.addEdge('6@b', '2@b', EdgeType.Reads)
			.addEdge('6@c', '3@c', EdgeType.Reads)
			.addEdge('6@d', '4@d', EdgeType.Reads)
			.addEdge('6@e', '5@e', EdgeType.Reads),
		opts);

	// a chain node's left operand may be a call, and the call's arguments must still resolve normally
	assertDataflow(label('a chain mixing calls and operators reads every operand', ['binary-operator', 'operators', 'call-normal']), ts,
		'a <- 1\nb <- 2\nc <- 3\nf(a) + b - f(c)',
		emptyGraph()
			.addEdge('4@a', '1@a', EdgeType.Reads)
			.addEdge('4@b', '2@b', EdgeType.Reads)
			.addEdge('4@c', '3@c', EdgeType.Reads),
		opts);

	// the fold hands each level's left operand on as an already-processed argument; a redefinition partway
	// through the chain must still be picked up by the operands to its right
	assertDataflow(label('a chain reads the closest definition of a redefined operand', ['binary-operator', 'operators', 'name-normal']), ts,
		'x <- 1\ny <- x + x\nx <- 2\nz <- x - x + x',
		emptyGraph()
			.addEdge('2@x', '1@x', EdgeType.Reads)
			.addEdge('4@x', '3@x', EdgeType.Reads)
			.addEdge('4:10', '3@x', EdgeType.Reads),
		{ ...opts, mustNotHaveEdges: [['4@x', '1@x']] });

	test.each([
		{ name: 'alternating + and -', op: (i: number) => i % 2 === 0 ? '+' : '-' },
		{ name: 'cycling through + - * /', op: (i: number) => ['+', '-', '*', '/'][i % 4] },
	])('a deep chain $name folds without overflowing the stack', async({ op }) => {
		// nesting this deep overflowed the stack when each level cost several call frames
		const levels = 600;
		let code = 'x <- 1\ny <- x';
		for(let i = 0; i < levels; i++) {
			code += ` ${op(i)} x`;
		}
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(code);
		const df = await analyzer.dataflow();
		// every level of the chain has to survive the fold, not just the outermost one
		const operators = new Set(Array.from({ length: levels }, (_, i) => op(i)));
		const calls = Array.from(df.graph.verticesOfType(VertexType.FunctionCall))
			.filter(([, v]) => operators.has(Identifier.toString(v.name)));
		expect(calls).toHaveLength(levels);
	});
}));
