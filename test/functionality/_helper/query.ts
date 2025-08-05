import type { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Query, QueryResults, QueryResultsWithoutMeta } from '../../../src/queries/query';
import { executeQueries, SupportedQueries } from '../../../src/queries/query';
import type { VirtualQueryArgumentsWithType } from '../../../src/queries/virtual-query/virtual-queries';
import type { TestLabel } from './label';
import { decorateLabelContext } from './label';
import type { VirtualCompoundConstraint } from '../../../src/queries/virtual-query/compound-query';
import { log } from '../../../src/util/log';
import { dataflowGraphToMermaidUrl } from '../../../src/core/print/dataflow-printer';
import type { PipelineOutput } from '../../../src/core/steps/pipeline/pipeline';
import { assert, test } from 'vitest';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import { defaultConfigOptions } from '../../../src/config';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { extractCfg } from '../../../src/control-flow/extract-cfg';


function normalizeResults<Queries extends Query>(result: QueryResults<Queries['type']>): QueryResultsWithoutMeta<Queries> {
	return JSON.parse(JSON.stringify(result, (key: unknown, value: unknown) => {
		if(key === '.meta') {
			return undefined;
		}
		return value;
	})) as QueryResultsWithoutMeta<Queries>;
}

/**
 * Asserts the result of a query
 *
 * @param name     - Name of the test case to generate
 * @param parser   - R Shell Session/Parser to use
 * @param code     - R code to execute the query on
 * @param queries  - Queries to execute
 * @param expected - Expected result of the queries (without attached meta-information like timing)
 */
export function assertQuery<
	Queries extends Query,
	VirtualArguments extends VirtualCompoundConstraint<Queries['type']> = VirtualCompoundConstraint<Queries['type']>
>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	queries: readonly (Queries | VirtualQueryArgumentsWithType<Queries['type'], VirtualArguments>)[],
	expected: QueryResultsWithoutMeta<Queries> | ((info: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>) => (QueryResultsWithoutMeta<Queries> | Promise<QueryResultsWithoutMeta<Queries>>))
) {
	const effectiveName = decorateLabelContext(name, ['query']);

	test(effectiveName, async() => {
		for(const query of queries) {
			if(query.type === 'compound') {
				continue;
			}
			const queryType = SupportedQueries[query.type];
			const queryString = JSON.stringify(query, (_key, value) => {
				if(value instanceof RegExp) {
					return value.toString();
				}
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return value;
			});
			const validationResult = queryType.schema.validate(JSON.parse(queryString));
			if(validationResult.error) {
				assert.fail(`Invalid query: ${validationResult.error.message}`);
			}
		}

		const info = await createDataflowPipeline(parser, {
			request: requestFromInput(code),
			getId:   deterministicCountingIdGenerator(0)
		}, defaultConfigOptions).allRemainingSteps();

		const result = await executeQueries<Queries['type'], VirtualArguments>({ dataflow: info.dataflow, ast: info.normalize, config: defaultConfigOptions }, queries);

		log.info(`total query time: ${result['.meta'].timing.toFixed(0)}ms (~1ms accuracy)`);

		const normalized = normalizeResults(result);

		/* expect them to be deeply equal */
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const expectedNormalized = normalizeResults(typeof expected === 'function' ? await expected(info) : expected);
			assert.deepStrictEqual(normalized, expectedNormalized, 'The result of the query does not match the expected result');
		} /* v8 ignore next 3 */ catch(e: unknown) {
			console.error('Dataflow-Graph', dataflowGraphToMermaidUrl(info.dataflow));
			console.error('Control-Flow-Graph', cfgToMermaidUrl(extractCfg(info.normalize, defaultConfigOptions, info.dataflow.graph), info.normalize));
			throw e;
		}
	});
}
