import { describe, assert, test, beforeAll } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';

/** every node of `code` as `numeric id -> stable id`, from a fresh analysis starting its ids at `startAt` */
async function stableIds(code: string, startAt: number): Promise<Map<string, string | undefined>> {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setInput({ getId: deterministicCountingIdGenerator(startAt) })
		.setParser(new TreeSitterExecutor()).build();
	analyzer.addRequest(code);
	const ast = await analyzer.normalize();
	return new Map([...ast.idMap.values()].map(n => [String(n.info.id), RNode.stableId(n)]));
}

describe('RNode.stableId', () => {
	beforeAll(async() => {
		await TreeSitterExecutor.initTreeSitter();
	});

	const code = 'x <- 1\nprint(x)\nf <- function(a) a + 1\n';

	// the numeric ids mean nothing outside the analysis that handed them out, the stable ones have to agree
	test('two analyses of the same text agree, even when the numeric ids do not', async() => {
		const first = await stableIds(code, 0);
		const second = await stableIds(code, 500);
		assert.notDeepEqual([...first.keys()], [...second.keys()], 'the numeric ids have to differ for this to say anything');
		const known = (m: Map<string, string | undefined>) => [...m.values()].filter(v => v !== undefined).sort();
		assert.deepStrictEqual(known(first), known(second));
		assert.isAbove(known(first).length, 0);
	});

	test('it names the file, where the node starts, and what it is', async() => {
		const ids = [...(await stableIds('x <- 1\n', 0)).values()].filter(v => v !== undefined);
		// inline code has no file, so the path part is empty
		// the `<-` is located at the operator itself, not at the start of the statement
		assert.deepStrictEqual(ids.sort(), [':1:1:RSymbol', ':1:3:RBinaryOp', ':1:6:RNumber']);
	});

	test('a node without a location has none', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
		analyzer.addRequest('x <- 1\n');
		const ast = await analyzer.normalize();
		const located = [...ast.idMap.values()].filter(n => n.location !== undefined);
		assert.isTrue(located.every(n => RNode.stableId(n) !== undefined));
		assert.isTrue([...ast.idMap.values()].filter(n => n.location === undefined)
			.every(n => RNode.stableId(n) === undefined));
	});
});
