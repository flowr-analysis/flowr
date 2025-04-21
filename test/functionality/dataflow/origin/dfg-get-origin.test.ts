import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { Origin } from '../../../../src/dataflow/origin/dfg-get-origin';
import { getOriginInDfg, OriginType } from '../../../../src/dataflow/origin/dfg-get-origin';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('Dataflow', withTreeSitter(ts => {
	describe('getOriginInDfg', () => {
		function chk(code: string, node: SingleSlicingCriterion, expected: Origin[] | undefined): void  {
			test(code, async() => {
				const analysis = await createDataflowPipeline(ts, {
					request: requestFromInput(code)
				}).allRemainingSteps();

				const interestedId = slicingCriterionToId(node, analysis.normalize.idMap);
				const origins = getOriginInDfg(analysis.dataflow.graph, interestedId);
				if(expected === undefined) {
					assert.isUndefined(origins);
				} else {
					// sort both by ids
					origins?.sort((a, b) => String(a.id).localeCompare(String(b.id)));
					expected = expected.map(e => ({
						...e,
						id: slicingCriterionToId(e.id as SingleSlicingCriterion, analysis.normalize.idMap)
					}));
					assert.deepStrictEqual(origins, expected);
				}
			});
		}
		const wo = (id: NodeId): Origin => ({ type: OriginType.WriteVariableOrigin, id });

		chk('x <- 2\nprint(x)', '2@x', [wo('1@x')]);
		chk('x <- 2\nif(u) {\n  x <- 3\n}\nprint(x)', '3@x', [wo('1@x'), wo('3@x')]);
	});
}));