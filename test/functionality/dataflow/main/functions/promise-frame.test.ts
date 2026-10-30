import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { Dataflow } from '../../../../../src/dataflow/graph/df-helper';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';

describe('an argument is evaluated in the frame of its call', withTreeSitter(ts => {
	/** whether the use `read` reads the definition `definition`, both given as slicing criteria */
	async function reads(code: string, read: SlicingCriterion, definition: SlicingCriterion): Promise<boolean> {
		const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
		analyzer.addRequest(requestFromInput(code));
		const idMap = (await analyzer.normalize()).idMap;
		const graph = (await analyzer.dataflow()).graph;
		return Dataflow.targetsOf(graph, SlicingCriterion.parse(read, idMap), EdgeType.Reads).includes(SlicingCriterion.parse(definition, idMap));
	}
	test('a parameter of the callee forcing it is not what it reads', async() => {
		const code = 'w <- function(q, v) cat(v)\ng <- function(q) w(1, toupper(q))\ng("a")';
		assert.isFalse(await reads(code, '2:31', '1:15'), 'the parameter of `w` is not in scope of the argument');
		assert.isTrue(await reads(code, '2:31', '2:15'), 'the parameter of `g` is');
	});
	test('a local binding of the callee is not what it reads', async() => {
		const code = 'q <- "top"\nw <- function(v) { q <- "local"; cat(v) }\nw(toupper(q))';
		assert.isFalse(await reads(code, '3:11', '2:20'), 'the local `q` of `w` is not in scope of the argument');
		assert.isTrue(await reads(code, '3:11', '1:1'), 'the global `q` is');
	});
	test('a super assignment of the callee may be what it reads', async() => {
		const code = 'q <- "top"\nw <- function(v) { q <<- "set"; cat(v) }\nw(toupper(q))';
		assert.isTrue(await reads(code, '3:11', '2:20'), 'the `<<-` binds where the argument looks');
	});
}));
