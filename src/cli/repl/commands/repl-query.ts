import type { RShell } from '../../../r-bridge/shell';
import { PipelineExecutor } from '../../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import type { ReplCommand, ReplOutput } from './repl-main';
import { splitAtEscapeSensitive } from '../../../util/args';
import type { OutputFormatter } from '../../../util/ansi';
import { bold, italic } from '../../../util/ansi';

import type { CallContextQuerySubKindResult } from '../../../queries/catalog/call-context-query/call-context-query-format';
import { describeSchema } from '../../../util/schema';
import type { Query, QueryResults, SupportedQueryTypes } from '../../../queries/query';
import { executeQueries } from '../../../queries/query';
import type { PipelineOutput } from '../../../core/steps/pipeline/pipeline';
import type { BaseQueryMeta } from '../../../queries/base-query-format';
import { jsonReplacer } from '../../../util/json';
import { AnyQuerySchema, QueriesSchema } from '../../../queries/query-schema';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltIn } from '../../../dataflow/environments/built-in';
import { graphToMermaidUrl } from '../../../util/mermaid/dfg';
import { normalizedAstToMermaidUrl } from '../../../util/mermaid/ast';

import { printAsMs } from '../../../util/time';
import { textWithTooltip } from '../../../documentation/doc-util/doc-hover-over';
import type { StaticSliceQuery } from '../../../queries/catalog/static-slice-query/static-slice-query-format';

async function getDataflow(shell: RShell, remainingLine: string) {
	return await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps();
}


function printHelp(output: ReplOutput) {
	output.stderr(`Format: ${italic(':query "<query>" <code>', output.formatter)}`);
	output.stdout('The query is an array of query objects to represent multiple queries. Each query object may have the following properties:');
	output.stdout(describeSchema(AnyQuerySchema, output.formatter));
	output.stdout(`\n\nThe example ${italic(':query "[{\\"type\\": \\"call-context\\", \\"callName\\": \\"mean\\" }]" mean(1:10)', output.formatter)} would return the call context of the mean function.`);
	output.stdout('As a convenience, we interpret any (non-help) string not starting with \'[\' as a regex for the simple call-context query.');
	output.stdout(`Hence, ${italic(':query "mean" mean(1:10)', output.formatter)} is equivalent to the above example.`);
}

async function processQueryArgs(line: string, shell: RShell, output: ReplOutput): Promise<undefined | { query: QueryResults<SupportedQueryTypes>, processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE> }> {
	const args = splitAtEscapeSensitive(line);
	const query = args.shift();

	if(!query) {
		output.stderr(`No query provided, use ':query help' to get more information.`);
		return;
	}
	if(query === 'help') {
		printHelp(output);
		return;
	}

	let parsedQuery: Query[] = [];
	if(query.startsWith('[')) {
		parsedQuery = JSON.parse(query) as Query[];
		const validationResult = QueriesSchema.validate(parsedQuery);
		if(validationResult.error) {
			output.stderr(`Invalid query: ${validationResult.error.message}`);
			printHelp(output);
			return;
		}
	} else {
		parsedQuery = [{ type: 'call-context', callName: query }];
	}

	const processed = await getDataflow(shell, args.join(' '));
	return {
		query: executeQueries({ graph: processed.dataflow.graph, ast: processed.normalize }, parsedQuery),
		processed
	};
}

function nodeString(id: NodeId, formatter: OutputFormatter, processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>): string {
	if(id === BuiltIn) {
		return italic('built-in', formatter);
	}
	const node = processed.normalize.idMap.get(id);
	if(node === undefined) {
		return `UNKNOWN: ${id}`;
	}
	return `${italic('`' + (node.lexeme ?? node.info.fullLexeme ?? 'UNKNOWN') + '`', formatter)} (L.${node.location?.[0]})`;
}

function asciiCallContextSubHit(formatter: OutputFormatter, results: readonly CallContextQuerySubKindResult[], processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>): string {
	const result: string[] = [];
	for(const { id, calls = [], linkedIds = [], aliasRoots = [] } of results) {
		const node = processed.normalize.idMap.get(id);
		if(node === undefined) {
			result.push(` ${bold('UNKNOWN: ' + JSON.stringify({ calls, linkedIds }))}`);
			continue;
		}
		let line = nodeString(id, formatter, processed);
		if(calls.length > 0) {
			line += ` with ${calls.length} call${calls.length > 1 ? 's' : ''} (${calls.map(c => nodeString(c, formatter, processed)).join(', ')})`;
		}
		if(linkedIds.length > 0) {
			line += ` with ${linkedIds.length} link${linkedIds.length > 1 ? 's' : ''} (${linkedIds.map(c => nodeString(c, formatter, processed)).join(', ')})`;
		}
		if(aliasRoots.length > 0) {
			line += ` with ${aliasRoots.length} alias root${aliasRoots.length > 1 ? 's' : ''} (${aliasRoots.map(c => nodeString(c, formatter, processed)).join(', ')})`;
		}
		result.push(line);
	}
	return result.join(', ');
}

function asciiCallContext(formatter: OutputFormatter, results: QueryResults<'call-context'>['call-context'], processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>): string {
	/* traverse over 'kinds' and within them 'subkinds' */
	const result: string[] = [];
	for(const [kind, { subkinds }] of Object.entries(results['kinds'])) {
		result.push(`   ╰ ${bold(kind, formatter)}`);
		for(const [subkind, values] of Object.entries(subkinds)) {
			result.push(`     ╰ ${bold(subkind, formatter)}: ${asciiCallContextSubHit(formatter, values, processed)}`);
		}
	}
	return result.join('\n');
}

function summarizeIdsIfTooLong(ids: readonly NodeId[]) {
	const naive = ids.join(', ');
	if(naive.length <= 20) {
		return naive;
	}
	let acc = '';
	let i = 0;
	while(acc.length <= 20) {
		acc += ids[i++] + ', ';
	}
	if(i < ids.length) {
		acc += '... (see JSON below)';
	}
	return textWithTooltip(acc, JSON.stringify(ids));
}

export function asciiSummaryOfQueryResult(formatter: OutputFormatter, totalInMs: number, results: QueryResults<SupportedQueryTypes>, processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>): string {
	const result: string[] = [];

	for(const [query, queryResults] of Object.entries(results)) {
		if(query === '.meta') {
			continue;
		}
		if(query === 'call-context') {
			const out = queryResults as QueryResults<'call-context'>['call-context'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(asciiCallContext(formatter, out, processed));
			continue;
		} else if(query === 'dataflow') {
			const out = queryResults as QueryResults<'dataflow'>['dataflow'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(`   ╰ [Dataflow Graph](${graphToMermaidUrl(out.graph)})`);
			continue;
		} else if(query === 'id-map') {
			const out = queryResults as QueryResults<'id-map'>['id-map'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(`   ╰ Id List: {${summarizeIdsIfTooLong([...out.idMap.keys()])}}`);
			continue;
		} else if(query === 'normalized-ast') {
			const out = queryResults as QueryResults<'normalized-ast'>['normalized-ast'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(`   ╰ [Normalized AST](${normalizedAstToMermaidUrl(out.normalized.ast)})`);
			continue;
		} else if(query === 'static-slice') {
			const out = queryResults as QueryResults<'static-slice'>['static-slice'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			for(const [fingerprint, obj] of Object.entries(out.results)) {
				const { criteria, noMagicComments, noReconstruction } = JSON.parse(fingerprint) as StaticSliceQuery;
				const addons = [];
				if(noReconstruction) {
					addons.push('no reconstruction');
				}
				if(noMagicComments) {
					addons.push('no magic comments');
				}
				result.push(`   ╰ Slice for {${criteria.join(', ')}} ${addons.join(', ')}`);
				if('reconstruct' in obj) {
					result.push('     ╰ Code (newline as <code>&#92;n</code>): <code>' + obj.reconstruct.code.split('\n').join('\\n') + '</code>');
				} else {
					result.push(`     ╰ Id List: {${summarizeIdsIfTooLong([...obj.slice.result])}}`);
				}
			}
			continue;
		} else if(query === 'dataflow-cluster') {
			const out = queryResults as QueryResults<'dataflow-cluster'>['dataflow-cluster'];
			result.push(`Query: ${bold(query, formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
			result.push(`   ╰ Found ${out.clusters.length} cluster${out.clusters.length === 1 ? '': 's'}`);
			for(const cluster of out.clusters) {
				const unknownSideEffects = cluster.hasUnknownSideEffects ? '(has unknown side effect)' : '';
				result.push(`      ╰ ${unknownSideEffects} {${summarizeIdsIfTooLong(cluster.members)}} ([marked](${
					graphToMermaidUrl(processed.dataflow.graph, false, new Set(cluster.members))
				}))`);
			}
			continue;
		}

		result.push(`Query: ${bold(query, formatter)}`);

		let timing = -1;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		for(const [key, value] of Object.entries(queryResults)) {
			if(key === '.meta') {
				timing = (value as BaseQueryMeta).timing;
				continue;
			}
			result.push(` ╰ ${key}: ${JSON.stringify(value)}`);
		}
		result.push(`  - Took ${printAsMs(timing, 0)}`);
	}

	result.push(italic(`All queries together required ≈${printAsMs(results['.meta'].timing, 0)} (1ms accuracy, total ${printAsMs(totalInMs, 0)})`, formatter));
	return formatter.format(result.join('\n'));
}

export const queryCommand: ReplCommand = {
	description:  `Query the given R code, start with '${fileProtocol}' to indicate a file. The query is to be a valid query in json format (use 'help' to get more information).`,
	usageExample: ':query "<query>" <code>',
	aliases:      [],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const totalStart = Date.now();
		const results = await processQueryArgs(remainingLine, shell, output);
		const totalEnd = Date.now();
		if(results) {
			output.stdout(asciiSummaryOfQueryResult(output.formatter, totalEnd - totalStart, results.query, results.processed));
		}
	}
};

export const queryStarCommand: ReplCommand = {
	description:  'Similar to query, but returns the output in json format.',
	usageExample: ':query* <query> <code>',
	aliases:      [ ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const results = await processQueryArgs(remainingLine, shell, output);
		if(results) {
			output.stdout(JSON.stringify(results.query, jsonReplacer));
		}
	}
};
