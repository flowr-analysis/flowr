import type { TestLabel } from './label';
import { decorateLabelContext } from './label';
import type { RShell } from '../../../src/r-bridge/shell';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { assert, beforeAll, describe, test } from 'vitest';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { dataflowGraphToMermaidUrl } from '../../../src/core/print/dataflow-printer';
import type { FlowrSearchLike } from '../../../src/search/flowr-search-builder';
import { getFlowrSearch } from '../../../src/search/flowr-search-builder';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { runSearch } from '../../../src/search/flowr-search-executor';
import { arrayEqual } from '../../../src/util/collections/arrays';
import {
	type SingleSlicingCriterion,
	slicingCriterionToId
} from '../../../src/slicing/criterion/parse';
import type { PipelineOutput } from '../../../src/core/steps/pipeline/pipeline';
import { guard, isNotUndefined } from '../../../src/util/assert';
import { flowrSearchToAscii } from '../../../src/search/flowr-search-printer';

/**
 * Asserts the result of a search or a set of searches (all of which should return the same result)!
 * The `expectedIds` may be slicing criteria, which will be converted to node ids
 */
export function assertSearch(
	name: string | TestLabel,
	shell: RShell,
	code: string,
	expectedIds: readonly NodeId[],
	...searches: FlowrSearchLike[]
) {
	const effectiveName = decorateLabelContext(name, ['search']);
	describe(effectiveName, () => {
		let results: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE> | undefined;
		beforeAll(async() => {
			results = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
				parser:  shell,
				request: requestFromInput(code),
				getId:   deterministicCountingIdGenerator(0)
			}).allRemainingSteps();
		});


		describe.each([true, false])('optimize %s', optimize => {
			test.each(searches)('%s', search => {
				guard(isNotUndefined(results), 'Results must be defined');
				const info = results;
				search = getFlowrSearch(search, optimize);

				const result = runSearch(search, info);
				try {
					expectedIds = expectedIds.map(id => {
						try {
							return slicingCriterionToId(id as SingleSlicingCriterion, info.normalize.idMap);
						} catch{
							/* just keep it :D */
							return id;
						}
					});
					assert(
						arrayEqual(result.map(r => r.node.info.id).sort(), [...expectedIds].sort()),
						`Expected search results to match. Wanted: [${expectedIds.join(', ')}], got: [${result.map(r => r.node.info.id).join(', ')}]`);
				} /* v8 ignore next 4 */ catch(e: unknown) {
					console.error('Dataflow-Graph', dataflowGraphToMermaidUrl(info.dataflow));
					console.error('Search', flowrSearchToAscii(search));
					throw e;
				}
			});
		});
	});
}
