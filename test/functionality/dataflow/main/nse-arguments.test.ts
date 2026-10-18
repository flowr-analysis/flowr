import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { DfEdge, EdgeType } from '../../../../src/dataflow/graph/edge';
import { ArgProp, FnSig } from '../../../../src/dataflow/environments/built-in-props';

describe('Arguments a call evaluates other than in the caller', withTreeSitter(ts => {
	/** checks which of the symbols carry a non-standard-evaluation mark */
	function testMarks(label: string, code: string, marked: readonly SlicingCriterion[], unmarked: readonly SlicingCriterion[]): void {
		test(label, async() => {
			const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
			analyzer.addRequest(requestFromInput(code));
			const idMap = (await analyzer.normalize()).idMap;
			const graph = (await analyzer.dataflow()).graph;
			for(const [criteria, expected] of [[marked, true], [unmarked, false]] as const) {
				for(const criterion of criteria) {
					const id = SlicingCriterion.parse(criterion, idMap);
					const isMarked = graph.edgesTo(id).values().some(e => DfEdge.includesType(e, EdgeType.NonStandardEvaluation));
					assert.strictEqual(isMarked, expected, `${criterion} in ${code}`);
				}
			}
		});
	}

	/* marking the first argument once marked every later one too, as its graph was the call's graph by then */
	testMarks('only the first argument of a native call is masked', '.C(foo, x, y)', ['1@foo'], ['1@x', '1@y']);
	/* the data is the argument filling the first parameter, wherever it is written */
	testMarks('a named data argument is not masked', 'dplyr::mutate(z = y, .data = df)', ['1@y'], ['1@df']);
	testMarks('a positional data argument is not masked', 'dplyr::mutate(df, z = y)', ['1@y'], ['1@df']);

	describe('slots', () => {
		const layout = FnSig.layout([['x', ArgProp.Value], ['y', ArgProp.Value], ['...', ArgProp.Value], ['z', ArgProp.Flag]]);
		test('positional', () => assert.deepStrictEqual(FnSig.slots(layout, [undefined, undefined, undefined]), [0, 1, 2]));
		test('a name takes its parameter first', () => assert.deepStrictEqual(FnSig.slots(layout, [undefined, 'x']), [1, 0]));
		test('after the dots only names match', () => assert.deepStrictEqual(FnSig.slots(layout, ['z', undefined, 'w']), [3, 0, 2]));
		test('without dots an unknown name fills nothing', () => assert.deepStrictEqual(FnSig.slots(FnSig.layout([['x', 0]]), ['w', undefined, undefined]), [-1, 0, -1]));
	});
}));
