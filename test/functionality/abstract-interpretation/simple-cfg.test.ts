import { assert, describe, test } from 'vitest';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { RFalse, RTrue } from '../../../src/r-bridge/lang-4.x/convert-values';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { CfgVertexType, emptyControlFlowInformation } from '../../../src/util/cfg/cfg';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import { withShell } from '../_helper/shell';
import type { SimpleControlFlowInformation } from '../../../src/abstract-interpretation/simple-cfg';
import { extractSimpleCFG, SimpleCfgVertexType, SimpleControlFlowGraph } from '../../../src/abstract-interpretation/simple-cfg';

describe.sequential('Simple Control Flow Graph', withShell(shell => {
	function assertCfg(code: string, partialExpected: Partial<SimpleControlFlowInformation>) {
		const expected: SimpleControlFlowInformation = { ...emptyControlFlowInformation(), graph: new SimpleControlFlowGraph(), ...partialExpected };

		return test(code, async()=> {
			const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
				parser:  shell,
				request: requestFromInput(code)
			}).allRemainingSteps();
			const cfg = extractSimpleCFG(result.normalize);

			try {
				assert.deepStrictEqual(cfg.entryPoints, expected.entryPoints, 'entry points differ');
				assert.deepStrictEqual(cfg.exitPoints, expected.exitPoints, 'exit points differ');
				assert.deepStrictEqual(cfg.breaks, expected.breaks, 'breaks differ');
				assert.deepStrictEqual(cfg.nexts, expected.nexts, 'nexts differ');
				assert.deepStrictEqual(cfg.returns, expected.returns, 'returns differ');
				assert.deepStrictEqual(cfg.graph.vertices(), expected.graph.vertices(), 'vertices differ');
				assert.deepStrictEqual(cfg.graph.edges(), expected.graph.edges(), 'edges differ');
			} /* v8 ignore next 4 */ catch(e: unknown) {
				console.error(`expected: ${cfgToMermaidUrl(expected, result.normalize)}`);
				console.error(`actual: ${cfgToMermaidUrl(cfg, result.normalize)}`);
				throw e;
			}
		});
	}

	assertCfg('x <- 42\nx <- x + 4\nprint(x)', {
		entryPoints: [2],
		exitPoints:  [11],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 2, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 7, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 11, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(2, 7, { label: 'FD' })
			.addEdge(7, 11, { label: 'FD' })
	});

	assertCfg('if(TRUE) 1', {
		entryPoints: [3],
		exitPoints:  [1, 3],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 3, name: RType.IfThenElse, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.IfThenElse })
			.addVertex({ id: 1, name: RType.Number, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(3, 1, { label: 'CD', when: RTrue, caused: 3 })
	});

	assertCfg('df <- data.frame(id = 1:5)\nif(nrow(df) > 5) {\ndf$name <- "A"\n} else {\ndf$name <- "B"\n}\nprint(df)', {
		entryPoints: [8],
		exitPoints:  [37],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 8, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 33, name: RType.IfThenElse, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.IfThenElse })
			.addVertex({ id: 22, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 31, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 37, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(8, 33, { label: 'FD' })
			.addEdge(33, 22, { label: 'CD', when: RTrue, caused: 33 })
			.addEdge(33, 31, { label: 'CD', when: RFalse, caused: 33 })
			.addEdge(22, 37, { label: 'FD' })
			.addEdge(31, 37, { label: 'FD' })
	});

	assertCfg('if (TRUE) {} else {}\nprint("Hello World!")', {
		entryPoints: [7],
		exitPoints:  [11],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 7, name: RType.IfThenElse, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.IfThenElse })
			.addVertex({ id: 11, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(7, 11, { label: 'FD' })
	});

	assertCfg('if (TRUE) {} else {\nprint("Unreachable :)")\n}\nprint("Hello World!")', {
		entryPoints: [11],
		exitPoints:  [15],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 11, name: RType.IfThenElse, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.IfThenElse })
			.addVertex({ id: 9, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 15, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(11, 15, { label: 'CD', when: RTrue, caused: 11 })
			.addEdge(11, 9, { label: 'CD', when: RFalse, caused: 11 })
			.addEdge(9, 15, { label: 'FD' })
	});

	assertCfg('repeat {\nbreak\n}\nprint("Hello World!")', {
		entryPoints: [4],
		exitPoints:  [8],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 4, name: RType.RepeatLoop, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.RepeatLoop })
			.addVertex({ id: 2, name: RType.Break, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.Break })
			.addVertex({ id: 8, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(4, 2, { label: 'FD' })
			.addEdge(2, 8, { label: 'FD' })
	});

	assertCfg('df <- data.frame(id = 1:5)\nfor (x in 1:10) {\ndf <- rbind(df, x)\n}\nprint(df)', {
		entryPoints: [8],
		exitPoints:  [28],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 8, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 24, name: RType.ForLoop, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.ForLoop })
			.addVertex({ id: 22, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 28, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(8, 24, { label: 'FD' })
			.addEdge(24, 22, { label: 'CD', when: RTrue, caused: 24 })
			.addEdge(24, 28, { label: 'CD', when: RFalse, caused: 24 })
			.addEdge(22, 24, { label: 'FD' })
	});

	assertCfg('x <- 42\nfor (i in 1:n) {\nif (i == 5) {\nbreak\n}\n}\nprint(x)', {
		entryPoints: [2],
		exitPoints:  [22],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 2, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 18, name: RType.ForLoop, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.ForLoop })
			.addVertex({ id: 16, name: RType.IfThenElse, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.IfThenElse })
			.addVertex({ id: 14, name: RType.Break, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.Break })
			.addVertex({ id: 22, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(2, 18, { label: 'FD' })
			.addEdge(18, 16, { label: 'CD', when: RTrue, caused: 18 })
			.addEdge(18, 22, { label: 'CD', when: RFalse, caused: 18 })
			.addEdge(16, 14, { label: 'CD', when: RTrue, caused: 16 })
			.addEdge(16, 18, { label: 'CD', when: RFalse, caused: 16 })
			.addEdge(14, 22, { label: 'FD' })
	});

	assertCfg('x <- 42\nwhile(TRUE) {}\nprint("Unreachable :D!")', {
		entryPoints: [2],
		exitPoints:  [11],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 2, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 7, name: RType.WhileLoop, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.WhileLoop })
			.addVertex({ id: 11, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(2, 7, { label: 'FD' })
			.addEdge(7, 11, { label: 'CD', when: RFalse, caused: 7 })
	});

	assertCfg('x <- runif(50)\nif (n > 0) {\nif (n == 42) {\nx <- 44\n} else {\nx <- 5\n}\nprint(x)\n} else {\nx <- n\n}\nprint(x)', {
		entryPoints: [5],
		exitPoints:  [42],
		graph:       new SimpleControlFlowGraph()
			.addVertex({ id: 5, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 38, name: RType.IfThenElse, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.IfThenElse })
			.addVertex({ id: 26, name: RType.IfThenElse, type: CfgVertexType.Statement, tag: SimpleCfgVertexType.IfThenElse })
			.addVertex({ id: 18, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 24, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 30, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 36, name: RType.BinaryOp, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addVertex({ id: 42, name: RType.FunctionCall, type: CfgVertexType.Expression, tag: SimpleCfgVertexType.Expression })
			.addEdge(5, 38, { label: 'FD' })
			.addEdge(38, 26, { label: 'CD', when: RTrue, caused: 38 })
			.addEdge(38, 36, { label: 'CD', when: RFalse, caused: 38 })
			.addEdge(26, 18, { label: 'CD', when: RTrue, caused: 26 })
			.addEdge(26, 24, { label: 'CD', when: RFalse, caused: 26 })
			.addEdge(18, 30, { label: 'FD' })
			.addEdge(24, 30, { label: 'FD' })
			.addEdge(30, 42, { label: 'FD' })
			.addEdge(36, 42, { label: 'FD' })
	});
}));
