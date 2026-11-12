import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { BranchPaths } from '../../../src/abstract-interpretation/branch-paths';
import '../../../src/abstract-interpretation/branch-paths-interpreter';
import { VertexType } from '../../../src/dataflow/graph/vertex';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import { withTreeSitter } from '../_helper/shell';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('Branch paths', withTreeSitter(parser => {
	/** the paths to the first call named `name` in the only function, each step as `<lexeme of the cause>=<when>[@<lexeme of the arm>]` */
	async function pathsTo(code: string, name: string): Promise<string[][] | undefined> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(requestFromInput(code));
		const dfg = (await analyzer.dataflow()).graph;
		const ast = await analyzer.normalize();
		const paths = BranchPaths.create({ controlFlow: await analyzer.controlflow(), dfg, normalizedAst: ast, ctx: analyzer.inspectContext() });
		paths.start();
		const [definition] = dfg.verticesOfType(VertexType.FunctionDefinition).toArray();
		const [call] = dfg.verticesOfType(VertexType.FunctionCall).filter(([, v]) => Identifier.getName(v.name) === name).toArray();
		const lexeme = (id: NodeId) => NodeId.recoverName(id, ast.idMap) ?? String(id);
		return paths.pathsTo(definition[0], call[0])?.map(path => path.map(s => `${lexeme(s.cause)}=${s.when}${s.target === undefined ? '' : `@${lexeme(s.target)}`}`).sort()).sort();
	}

	test('what runs after an early return is reached only where it was not taken', async() => {
		assert.deepStrictEqual(await pathsTo('f <- function(x) { if(missing(x)) return(0); log(x) }', 'log'), [['if=false']]);
		assert.deepStrictEqual(await pathsTo('f <- function(x) { if(missing(x)) return(0); log(x) }', 'return'), [['if=true']]);
	});
	test('an else if is reached when the condition before it failed', async() => {
		const paths = await pathsTo('f <- function(x) { if(is.character(x)) 1 else if(is.numeric(x)) stop("n") }', 'stop');
		assert.deepStrictEqual(paths?.map(p => p.length), [2]);
		assert.deepStrictEqual(paths?.[0].map(s => s.split('=')[1]).sort(), ['false', 'true']);
	});
	test('each arm of a switch is told apart, by what it evaluates first', async() => {
		assert.deepStrictEqual(await pathsTo('f <- function(k) switch(k, a = 1, b = stop("no b"), 3)', 'stop'), [['switch=true@"no b"']]);
	});
	test('what is reached whichever way a branch went does not depend on it', async() => {
		assert.deepStrictEqual(await pathsTo('f <- function(x) { if(is.null(x)) y <- 1 else y <- 2; log(x) }', 'log'), [[]]);
	});
	test('the right operand of && runs once the left one held', async() => {
		assert.deepStrictEqual(await pathsTo('f <- function(x) is.numeric(x) && log(x) > 0', 'log'), [['&&=true']]);
	});
}));
