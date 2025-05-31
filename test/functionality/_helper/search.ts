import type { TestLabel } from './label';
import { decorateLabelContext } from './label';
import type { RShell } from '../../../src/r-bridge/shell';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { assert, beforeAll, describe, test } from 'vitest';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import type { ParentInformation } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
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
import type { FlowrSearchElement } from '../../../src/search/flowr-search';
import type { Enrichment, EnrichmentContent } from '../../../src/search/search-executor/search-enrichers';
import { enrichmentContent } from '../../../src/search/search-executor/search-enrichers';

/**
 * Asserts the result of a search or a set of searches (all of which should return the same result)!
 * The `expected` items may be slicing criteria, which will be converted to node ids, or a function to test the results.
 */
export function assertSearch(
	name: string | TestLabel,
	shell: RShell,
	code: string,
	expected: readonly (NodeId | SingleSlicingCriterion)[] | ((result: FlowrSearchElement<ParentInformation>[]) => boolean),
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
					if(Array.isArray(expected)) {
						expected = expected.map(id => {
							try {
								return slicingCriterionToId(id as SingleSlicingCriterion, info.normalize.idMap);
							} catch{
								/* just keep it :D */
								return id as NodeId;
							}
						});
						assert(
							arrayEqual(result.map(r => r.node.info.id).sort(), [...expected].sort()),
							`Expected search results to match. Wanted: [${expected.join(', ')}], got: [${result.map(r => r.node.info.id).join(', ')}]`);
					} else {
						const expectedFunc = expected as (result: FlowrSearchElement<ParentInformation>[]) => boolean;
						assert(expectedFunc(result), `Expected search results ${JSON.stringify(results)} to match expected function`);
					}
				} /* v8 ignore next 4 */ catch(e: unknown) {
					console.error('Dataflow-Graph', dataflowGraphToMermaidUrl(info.dataflow));
					console.error('Search', flowrSearchToAscii(search));
					throw e;
				}
			});
		});
	});
}

export function assertSearchEnrichment(
	name: string | TestLabel,
	shell: RShell,
	code: string,
	expectedEnrichments: readonly { [E in Enrichment]?: EnrichmentContent<E> }[],
	matchType: 'some' | 'every',
	...searches: FlowrSearchLike[]
) {
	assertSearch(name, shell, code, results => {
		for(const expected of expectedEnrichments) {
			for(const [enrichment, content] of Object.entries(expected)) {
				let any = false;
				for(const result of results) {
					try {
						assert.deepEqual(enrichmentContent(result, enrichment as Enrichment), content);
						any = true;
					} catch(e: unknown) {
						if(matchType === 'every') {
							throw e;
						}
					}
				}
				if(!any) {
					return false;
				}
			}
		}
		return true;
	}, ...searches);
}
