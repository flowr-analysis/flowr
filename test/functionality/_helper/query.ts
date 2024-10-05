import type { RShell } from '../../../src/r-bridge/shell';


import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { QueryResults, Query, QueryResultsWithoutMeta } from '../../../src/queries/query';
import { executeQueries } from '../../../src/queries/query';
import { assert } from 'chai';
import type { VirtualQueryArgumentsWithType } from '../../../src/queries/virtual-query/virtual-queries';
import type { TestLabel } from './label';
import { decorateLabelContext } from './label';
import type { VirtualCompoundConstraint } from '../../../src/queries/virtual-query/compound-query';
import { log } from '../../../src/util/log';
import { dataflowGraphToMermaidUrl } from '../../../src/core/print/dataflow-printer';
import type { PipelineOutput } from '../../../src/core/steps/pipeline/pipeline';


function normalizeResults<Queries extends Query>(result: QueryResults<Queries['type']>): QueryResultsWithoutMeta<Queries> {
	const normalized = {} as QueryResultsWithoutMeta<Queries>;
	for(const key of Object.keys(result) as (keyof QueryResults<Queries['type']>)[]) {
		if(key === '.meta') {
			continue;
		}
		const normalizedChild = {} as Omit<QueryResults<Queries['type']>, '.meta'>[typeof key];
		for(const childKey of Object.keys(result[key]) as (keyof QueryResults<Queries['type']>[typeof key])[]) {
			if(childKey === '.meta') {
				continue;
			}
			normalizedChild[childKey] = result[key][childKey];
		}
		normalized[key] = normalizedChild;
	}
	return normalized;
}

/**
 * Asserts the result of a query
 *
 * @param name     - Name of the test case to generate
 * @param shell    - R Shell Session to use
 * @param code     - R code to execute the query on
 * @param queries  - Queries to execute
 * @param expected - Expected result of the queries (without attached meta-information like timing)
 */
export function assertQuery<
	Queries extends Query,
	VirtualArguments extends VirtualCompoundConstraint<Queries['type']> = VirtualCompoundConstraint<Queries['type']>
>(name: string | TestLabel, shell: RShell, code: string, queries: readonly (Queries | VirtualQueryArgumentsWithType<Queries['type'], VirtualArguments>)[], expected:
	QueryResultsWithoutMeta<Queries> | ((info: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>) => QueryResultsWithoutMeta<Queries>)
) {
	const effectiveName = decorateLabelContext(name, ['query']);

	it(effectiveName, async() => {
		const info = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			shell,
			request: requestFromInput(code),
			getId:   deterministicCountingIdGenerator(0)
		}).allRemainingSteps();

		const result = executeQueries<Queries['type'], VirtualArguments>({ graph: info.dataflow.graph, ast: info.normalize }, queries);

		log.info(`total query time: ${result['.meta'].timing.toFixed(0)}ms (~1ms accuracy)`);

		const normalized = normalizeResults(result);

		/* expect them to be deeply equal */
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const expectedNormalized = typeof expected === 'function' ? expected(info) : expected;
			assert.deepStrictEqual(normalized, expectedNormalized, 'The result of the call context query does not match the expected result');
		} catch(e: unknown) {
			console.error('Dataflow-Graph', dataflowGraphToMermaidUrl(info.dataflow));
			throw e;
		}
	});
}
