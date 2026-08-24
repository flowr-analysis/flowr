import type {
	DEFAULT_DATAFLOW_PIPELINE,
	TREE_SITTER_DATAFLOW_PIPELINE
} from '../../../src/core/steps/pipeline/default-pipelines';
import {
	type Query,
	type QueryArgumentsWithType,
	type QueryResults,
	type QueryResultsWithoutMeta,
	executeQueries,
	SupportedQueries,
	type SupportedQueryTypes
} from '../../../src/queries/query';
import type { VirtualQueryArgumentsWithType } from '../../../src/queries/virtual-query/virtual-queries';
import { label, type TestLabel, decorateLabelContext } from './label';
import type { VirtualCompoundConstraint } from '../../../src/queries/virtual-query/compound-query';
import { log } from '../../../src/util/log';
import type { PipelineOutput } from '../../../src/core/steps/pipeline/pipeline';
import { assert, test } from 'vitest';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import type { KnownParser } from '../../../src/r-bridge/parser';
import type { AstIdMap } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { extractCfg } from '../../../src/control-flow/control-flow-graph';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import { Dataflow } from '../../../src/dataflow/graph/df-helper';
import { CallGraph } from '../../../src/dataflow/graph/call-graph';
import { applyAssumedPackages, assumedPackagesOf } from './shell';

function normalizeResults<Queries extends Query>(result: QueryResults<Queries['type']>): QueryResultsWithoutMeta<Queries> {
	return JSON.parse(JSON.stringify(result, (key: unknown, value: unknown) => {
		if(key === '.meta') {
			return undefined;
		}
		return value;
	})) as QueryResultsWithoutMeta<Queries>;
}

/**
 * Asserts the result of a query. `expected` excludes attached meta-information like timing; leave it undefined
 * to just check that execution did not throw.
 */
export function assertQuery<
	Queries extends Query,
	VirtualArguments extends VirtualCompoundConstraint<Queries['type']> = VirtualCompoundConstraint<Queries['type']>
>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	queries: readonly (Queries | VirtualQueryArgumentsWithType<Queries['type'], VirtualArguments>)[],
	expected?: QueryResultsWithoutMeta<Queries> | ((info: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE>) => (QueryResultsWithoutMeta<Queries> | Promise<QueryResultsWithoutMeta<Queries>>)),
	runFull = false,
	/** packages this query's code may use without attaching them, overriding the file's {@link assumeLoadedPackages} */
	assumeLoaded?: readonly string[]
) {
	const effectiveName = decorateLabelContext(name, ['query']);

	const assumed = assumedPackagesOf({ assumeLoaded });
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

		const analyzer = await applyAssumedPackages(new FlowrAnalyzerBuilder()
			.setParser(parser), assumed)
			.build();
		analyzer.addRequest(code);
		if(runFull) {
			// we run the dfa analysis to make sure normalization post-patches are ready!
			await analyzer.runFull();
		}

		const result = await executeQueries<Queries['type'], VirtualArguments>({
			analyzer
		}, queries);

		log.info(`total query time: ${result['.meta'].timing.toFixed(0)}ms (~1ms accuracy)`);

		if(expected === undefined) {
			// we only assert that we had no error!
			return;
		}
		const normalized = normalizeResults(result);

		/* expect them to be deeply equal */
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const expectedNormalized = normalizeResults(typeof expected === 'function' ? await expected(
				{
					parse:     await analyzer.parse(),
					normalize: await analyzer.normalize(),
					dataflow:  await analyzer.dataflow()
				}
			) : expected);
			assert.deepStrictEqual(normalized, expectedNormalized, 'The result of the query does not match the expected result');
		} /* v8 ignore next 3 */ catch(e: unknown) {
			console.error('Dataflow-Graph', Dataflow.visualize.mermaid.url(await analyzer.dataflow()));
			console.error('Control-Flow-Graph', cfgToMermaidUrl(extractCfg(await analyzer.dataflow()), await analyzer.normalize()));
			console.error('Call-Graph', CallGraph.visualize.mermaid.url(CallGraph.compute((await analyzer.dataflow()).graph)));
			throw e;
		}
	});
}

/**
 * Builds a fresh analyzer for `code`, runs a single `query` on it, and hands back its result together with the
 * id map and the analyzer itself (e.g., for a follow-up {@link FlowrAnalyzer.dataflow} call).
 */
export async function runQuery<Type extends SupportedQueryTypes>(
	parser: KnownParser,
	code: string,
	query: QueryArgumentsWithType<Type>
): Promise<{ result: QueryResults<Type>[Type], idMap: AstIdMap, analyzer: FlowrAnalyzer }> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
	analyzer.addRequest(code);
	const result = await analyzer.query<Type>([query]);
	const idMap = (await analyzer.normalize()).idMap;
	return { result: result[query.type], idMap, analyzer };
}

/**
 * Registers a labeled test (see {@link label}) that runs `query` via {@link runQuery} and hands the result to `check`.
 * Covers the common `inspect-*` query test shape: one query type, one snippet, one assertion over what came back.
 */
export function queryCase<Type extends SupportedQueryTypes>(
	parser: KnownParser,
	type: Type,
	name: string,
	code: string,
	check: (info: { result: QueryResults<Type>[Type], idMap: AstIdMap, analyzer: FlowrAnalyzer }) => void | Promise<void>
): void {
	test(label(name, ['name-normal'], ['other']), async() => {
		await check(await runQuery(parser, code, { type } as QueryArgumentsWithType<Type>));
	});
}

/**
 * Curries {@link queryCase} for the shape several `inspect-*` queries share: a per-definition record, reduced
 * to `flag` per definition, that the case checks either as a whole (this) or definition-by-definition ({@link testEachCase}).
 * `pick` extracts that record from the query result; `flag` decides what makes one of its entries count.
 */
export function testAnyCase<Type extends SupportedQueryTypes, V>(
	parser: KnownParser,
	type: Type,
	pick: (result: QueryResults<Type>[Type]) => Record<string, V>,
	flag: (value: V) => boolean
): (name: string, code: string, expected: boolean) => void {
	return (name, code, expected) => queryCase(parser, type, name, code, ({ result }) => {
		const found = pick(result);
		assert.isNotEmpty(Object.keys(found), 'the query has to report every function definition');
		assert.strictEqual(Object.values(found).some(flag), expected, JSON.stringify(found));
	});
}

/** Curries {@link queryCase} the same way as {@link testAnyCase}, but keeps one flag per definition, keyed by the definition as it is written. */
export function testEachCase<Type extends SupportedQueryTypes, V>(
	parser: KnownParser,
	type: Type,
	pick: (result: QueryResults<Type>[Type]) => Record<string, V>,
	flag: (value: V) => boolean
): (name: string, code: string, expected: Readonly<Record<string, boolean>>) => void {
	return (name, code, expected) => queryCase(parser, type, name, code, ({ result, idMap }) => {
		const found: Record<string, boolean> = {};
		for(const [id, value] of Object.entries(pick(result))) {
			found[idMap.get(Number(id))?.info.fullLexeme ?? id] = flag(value);
		}
		assert.deepStrictEqual(found, { ...expected });
	});
}
