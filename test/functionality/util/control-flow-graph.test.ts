import { withShell } from '../_helper/shell';
import type { ControlFlowInformation } from '../../../src/util/cfg/cfg';
import {
	cfg2quads,
	CfgVertexType,
	ControlFlowGraph,
	emptyControlFlowInformation,
	equalCfg,
	extractCFG
} from '../../../src/util/cfg/cfg';
import { defaultQuadIdGenerator } from '../../../src/util/quads';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { normalizeIdToNumberIfPossible } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { createNormalizePipeline, DEFAULT_NORMALIZE_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { RFalse, RTrue } from '../../../src/r-bridge/lang-4.x/convert-values';
import { assert, describe, test } from 'vitest';
import type { SingleSlicingCriterion } from '../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../src/slicing/criterion/parse';
import { Ternary } from '../../../src/util/logic';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { happensBefore } from '../../../src/util/cfg/happens-before';


function normAllIds(ids: NodeId[]): NodeId[] {
	return ids.map(normalizeIdToNumberIfPossible);
}

describe.sequential('Control Flow Graph', withShell(shell => {
	function assertCfg(code: string, partialExpected: Partial<ControlFlowInformation>) {
		// shallow copy is important to avoid killing the CFG :c
		const expected: ControlFlowInformation = { ...emptyControlFlowInformation(), ...partialExpected };
		return test(code, async()=> {
			const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
				parser:  shell,
				request: requestFromInput(code)
			}).allRemainingSteps();
			const cfg = extractCFG(result.normalize);

			try {
				assert.deepStrictEqual(normAllIds(cfg.entryPoints), normAllIds(expected.entryPoints), 'entry points differ');
				assert.deepStrictEqual(normAllIds(cfg.exitPoints), normAllIds(expected.exitPoints), 'exit points differ');
				assert.deepStrictEqual(normAllIds(cfg.breaks), normAllIds(expected.breaks), 'breaks differ');
				assert.deepStrictEqual(normAllIds(cfg.nexts), normAllIds(expected.nexts), 'nexts differ');
				assert.deepStrictEqual(normAllIds(cfg.returns), normAllIds(expected.returns), 'returns differ');
				assert.isTrue(equalCfg(cfg.graph, expected.graph), 'graphs differ');
			} /* v8 ignore next 4 */ catch(e: unknown) {
				console.error(`expected: ${cfgToMermaidUrl(expected, result.normalize)}`);
				console.error(`actual: ${cfgToMermaidUrl(cfg, result.normalize)}`);
				throw e;
			}
		});
	}

	assertCfg('if(TRUE) 1', {
		entryPoints: [ '3' ],
		exitPoints:  [ '3-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Logical, type: CfgVertexType.Expression })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 3, name: RType.IfThenElse, type: CfgVertexType.Statement })
			.addVertex({ id: '3-exit', name: 'if-exit', type: CfgVertexType.EndMarker })
			.addEdge(0, 3, { label: 'FD' })
			.addEdge(1, 0, { label: 'CD', when: RTrue, caused: 3 })
			.addEdge('3-exit', 1, { label: 'FD' })
			.addEdge('3-exit', 0, { label: 'CD', when: RFalse, caused: 3 })
	});

	assertCfg('2 + 3', {
		entryPoints: [ '2' ],
		exitPoints:  [ '2-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 2, name: RType.BinaryOp, type: CfgVertexType.Expression })
			.addVertex({ id: '2-exit', name: 'binOp-exit', type: CfgVertexType.EndMarker })
			.addEdge(0, 2, { label: 'FD' })
			.addEdge(1, 0, { label: 'FD' })
			.addEdge('2-exit', 1, { label: 'FD' })
	});

	assertCfg('f(2 + 3, x=3)', {
		entryPoints: [ '8' ],
		exitPoints:  [ '8-exit' ],
		graph:       new ControlFlowGraph()
			.addVertex({ id: 0, name: RType.Symbol, type: CfgVertexType.Expression })
			.addVertex({ id: 8, name: RType.FunctionCall, type: CfgVertexType.Statement  })
			.addVertex({ id: '8-name', name: 'call-name', type: CfgVertexType.MidMarker })
			.addVertex({ id: '8-exit', name: 'call-exit', type: CfgVertexType.EndMarker })

			.addVertex({ id: 4, name: RType.Argument, type: CfgVertexType.Expression })
			.addVertex({ id: '4-before-value', name: 'before-value', type: CfgVertexType.MidMarker })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 2, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: 3, name: RType.BinaryOp, type: CfgVertexType.Expression })
			.addVertex({ id: '3-exit', name: 'binOp-exit', type: CfgVertexType.EndMarker })
			.addVertex({ id: '4-exit', name: 'exit', type: CfgVertexType.EndMarker })

			.addVertex({ id: 7, name: RType.Argument, type: CfgVertexType.Expression })
			.addVertex({ id: 5, name: RType.Symbol, type: CfgVertexType.Expression })
			.addVertex({ id: '7-before-value', name: 'before-value', type: CfgVertexType.MidMarker })
			.addVertex({ id: 6, name: RType.Number, type: CfgVertexType.Expression })
			.addVertex({ id: '7-exit', name: 'exit', type: CfgVertexType.EndMarker })

			.addEdge(0, 8, { label: 'FD' })
			.addEdge('8-name', 0, { label: 'FD' })
			.addEdge(4, '8-name', { label: 'FD' })
			.addEdge('4-before-value', 4, { label: 'FD' })
			.addEdge(3, '4-before-value', { label: 'FD' })
			.addEdge(1, 3, { label: 'FD' })
			.addEdge(2, 1, { label: 'FD' })
			.addEdge('3-exit', 2, { label: 'FD' })
			.addEdge('4-exit', '3-exit', { label: 'FD' })

			.addEdge(7, '4-exit', { label: 'FD' })
			.addEdge(5, 7, { label: 'FD' })
			.addEdge('7-before-value', 5, { label: 'FD' })
			.addEdge(6, '7-before-value', { label: 'FD' })
			.addEdge('7-exit', 6, { label: 'FD' })
			.addEdge('8-exit', '7-exit', { label: 'FD' })
	});

	test('Example Quad Export', async() => {
		const domain = 'https://uni-ulm.de/r-ast/';
		const context = 'test';

		const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			parser:  shell,
			request: requestFromInput('if(TRUE) 1')
		}).allRemainingSteps();
		const cfg = extractCFG(result.normalize);

		const content = cfg2quads(cfg, { context, domain, getId: defaultQuadIdGenerator() });

		assert.strictEqual(content, `<${domain}${context}/0> <${domain}rootIds> "3"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/0> <${domain}rootIds> "3-exit" <${context}> .
<${domain}${context}/0> <${domain}rootIds> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/0> <${domain}rootIds> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/0> <${domain}vertices> <${domain}${context}/1> <${context}> .
<${domain}${context}/1> <${domain}next> <${domain}${context}/2> <${context}> .
<${domain}${context}/1> <${domain}id> "3"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/1> <${domain}name> "RIfThenElse" <${context}> .
<${domain}${context}/0> <${domain}vertices> <${domain}${context}/2> <${context}> .
<${domain}${context}/2> <${domain}next> <${domain}${context}/3> <${context}> .
<${domain}${context}/2> <${domain}id> "3-exit" <${context}> .
<${domain}${context}/2> <${domain}name> "if-exit" <${context}> .
<${domain}${context}/0> <${domain}vertices> <${domain}${context}/3> <${context}> .
<${domain}${context}/3> <${domain}next> <${domain}${context}/4> <${context}> .
<${domain}${context}/3> <${domain}id> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/3> <${domain}name> "RLogical" <${context}> .
<${domain}${context}/0> <${domain}vertices> <${domain}${context}/4> <${context}> .
<${domain}${context}/4> <${domain}id> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/4> <${domain}name> "RNumber" <${context}> .
<${domain}${context}/0> <${domain}edges> <${domain}${context}/5> <${context}> .
<${domain}${context}/5> <${domain}next> <${domain}${context}/6> <${context}> .
<${domain}${context}/5> <${domain}from> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/5> <${domain}to> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/5> <${domain}type> "CD" <${context}> .
<${domain}${context}/5> <${domain}when> "TRUE" <${context}> .
<${domain}${context}/0> <${domain}edges> <${domain}${context}/6> <${context}> .
<${domain}${context}/6> <${domain}next> <${domain}${context}/7> <${context}> .
<${domain}${context}/6> <${domain}from> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/6> <${domain}to> "3"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/6> <${domain}type> "FD" <${context}> .
<${domain}${context}/0> <${domain}edges> <${domain}${context}/7> <${context}> .
<${domain}${context}/7> <${domain}next> <${domain}${context}/8> <${context}> .
<${domain}${context}/7> <${domain}from> "3-exit" <${context}> .
<${domain}${context}/7> <${domain}to> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/7> <${domain}type> "FD" <${context}> .
<${domain}${context}/0> <${domain}edges> <${domain}${context}/8> <${context}> .
<${domain}${context}/8> <${domain}from> "3-exit" <${context}> .
<${domain}${context}/8> <${domain}to> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/8> <${domain}type> "CD" <${context}> .
<${domain}${context}/8> <${domain}when> "FALSE" <${context}> .
<${domain}${context}/0> <${domain}entryPoints> "3"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/0> <${domain}exitPoints> "3-exit" <${context}> .
`);
	});
}));


describe.sequential('Happens Before', withShell(shell => {
	function assertHB(code: string, a: SingleSlicingCriterion, b: SingleSlicingCriterion, expected: Ternary) {
		// shallow copy is important to avoid killing the CFG :c
		return describe(code, () => {
			test.each([shell, new TreeSitterExecutor()])('%s', async parser => {
				const result = await createNormalizePipeline(parser, {
					request: requestFromInput(code)
				}).allRemainingSteps();
				const cfg = extractCFG(result.normalize);
				const aResolved = slicingCriterionToId(a, result.normalize.idMap);
				const bResolved = slicingCriterionToId(b, result.normalize.idMap);
				try {
					assert.strictEqual(happensBefore(cfg.graph, aResolved, bResolved), expected, `expected ${a} (resolved to ${aResolved}) to ${expected} happen before ${b} (resolved to ${bResolved})`);
					if(expected === Ternary.Always) {
						assert.strictEqual(happensBefore(cfg.graph, bResolved, aResolved), Ternary.Never, 'reversed');
					} else if(expected === Ternary.Never) {
						assert.strictEqual(happensBefore(cfg.graph, bResolved, aResolved), Ternary.Always, 'reversed');
					}
				} /* v8 ignore next 4 */ catch(e: unknown) {
					console.error(`actual: ${cfgToMermaidUrl(cfg, result.normalize)}`);
					throw e;
				}
			});
		});
	}

	assertHB('x <- 1\ny <- 2', '1@<-', '2@<-', Ternary.Always);
	assertHB('x <- 1\nprint(x)\ny <- 2\nprint(y)', '1@<-', '3@<-', Ternary.Always);
	for(const criteria of ['1@x','1@<-', '1@4'] as const) {
		assertHB('x <- 4\nrepeat { print(x) }', criteria, '2@print', Ternary.Always);
	}
	for(const [a, b, t] of [['1@x', '2@x', Ternary.Always], ['1@x', '3@<-', Ternary.Maybe], ['2@x', '3@x', Ternary.Maybe], ['2@<', '3@<-', Ternary.Maybe]] as const) {
		assertHB('x <- 4\nwhile(x < 1)\nx <- 5', a, b, t);
	}
	for(const [a, b, t] of [['1@x', '2@x', Ternary.Maybe], ['1@x', '2@u', Ternary.Always], ['2@x', '3@x', Ternary.Always], ['1@x', '3@x', Ternary.Always]] as const) {
		assertHB('x<-1\nif(u) x <- 2\nx <- 3', a, b, t);
	}
	assertHB('x<-1\nif(u) x <- 2 else x <- 3\nx <- 4', '1@x', '3@x', Ternary.Always);
}));
