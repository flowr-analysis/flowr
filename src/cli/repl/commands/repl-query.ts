import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { ansiFormatter, ansiInfo, bold, ColorEffect, Colors, italic } from '../../../util/text/ansi';
import {
	executeQueries,
	type Query,
	type QueryResults,
	SupportedQueries,
	type SupportedQuery,
	type SupportedQueryTypes,
	VirtualQuerySchema
} from '../../../queries/query';
import { SupportedVirtualQueries } from '../../../queries/virtual-query/virtual-queries';
import type { FlowrAnalysisProvider, ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { asciiSummaryOfQueryResult } from '../../../queries/query-print';
import { jsonReplacer } from '../../../util/json';
import type { BaseQueryResult } from '../../../queries/base-query-format';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { Record } from '../../../util/record';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import { watchProtocol } from '../core';
import fs from 'fs';

/** Whether `s` looks like a filesystem path the user likely meant to load via {@link fileProtocol}. */
function looksLikePath(s: string): boolean {
	if(s.startsWith(fileProtocol) || s.startsWith(watchProtocol)) {
		return false;
	}
	if(/^(~|\.{0,2}\/|[a-zA-Z]:[\\/])/.test(s)) {
		return true;
	}
	// a single path-like token (a separator, no R-code punctuation) that actually exists on disk
	return /^[^\s()]+\/[^\s()]+$/.test(s) && fs.existsSync(s);
}

/**
 * Whether the analyzer already holds exactly `input` as its sole request, so a prior analysis (e.g. a
 * dataflow computed via `:df#`) can be reused instead of being discarded by a reset.
 */
function analyzerHasTarget(analyzer: ReadonlyFlowrAnalysisProvider, input: string): boolean {
	const requested = requestFromInput(input);
	const current = analyzer.inspectContext().files.loadingOrder.getUnorderedRequests();
	return current.length === 1 && current[0].request === requested.request && current[0].content === requested.content;
}


function printHelp(output: ReplOutput) {
	output.stderr(`Format: ${italic(':query <query> <code>', output.formatter)}`);
	output.stdout('Queries starting with \'@<type>\' are interpreted as a query of the given type.');
	output.stdout(`With this, ${bold(':query @config', output.formatter)} prints the result of the config query.`);
	output.stdout(`If you want to run the linter on a project use:\n    ${bold(':query @linter file://<path>', output.formatter)} (or ${bold('watch://<path>', output.formatter)} to re-run on changes).`);
	output.stdout(ansiInfo('Otherwise, you can also directly pass the query json. Then, the query is an array of query objects to represent multiple queries.'));
	output.stdout(ansiInfo('The example') + italic(String.raw`:query "[{\"type\": \"call-context\", \"callName\": \"mean\" }]" mean(1:10)`, output.formatter, { color: Colors.White, effect: ColorEffect.Foreground }) + ansiInfo('would return the call context of the mean function.'));
	output.stdout('Please have a look at the wiki for more info: https://github.com/flowr-analysis/flowr/wiki/Query-API');
}

/** A copy-pasteable JSON template for a query type: its `type` plus each required field as a placeholder. */
function queryTemplate(type: string, schema: SupportedQuery['schema']): string {
	const keys = (schema.describe() as { keys?: Record<string, { flags?: { presence?: string } }> }).keys ?? {};
	const fields = [`\\"type\\": \\"${type}\\"`];
	for(const [key, value] of Object.entries(keys)) {
		if(key !== 'type' && value.flags?.presence === 'required') {
			fields.push(`\\"${key}\\": <${key}>`);
		}
	}
	return `:query "[{ ${fields.join(', ')} }]" <code | file://path>`;
}

/** Validates each query against its own type's schema and, on failure, prints a template for that type. */
export function validateQueries(output: ReplOutput, queries: readonly Query[]): boolean {
	for(const q of queries) {
		const type = q?.type;
		if(typeof type !== 'string' || (!Object.hasOwn(SupportedQueries, type) && !Object.hasOwn(SupportedVirtualQueries, type))) {
			output.stderr(`Unknown query type ${italic(JSON.stringify(type), output.formatter)}, use ${bold(':query help', output.formatter)} for the list of queries.`);
			return false;
		}
		const def = Object.hasOwn(SupportedQueries, type) ? SupportedQueries[type] as SupportedQuery : undefined;
		const { error } = (def?.schema ?? VirtualQuerySchema()).validate(q);
		if(error) {
			output.stderr(`Invalid ${bold('@' + type, output.formatter)} query:`);
			for(const detail of error.details) {
				output.stderr(`  - ${detail.message}`);
			}
			if(def) {
				output.stderr(`  Template: ${italic(queryTemplate(type, def.schema), output.formatter)}`);
			}
			return false;
		}
	}
	return true;
}

async function processQueryArgs(output: ReplOutput, analyzer: FlowrAnalysisProvider, remainingArgs: string[]): Promise<undefined | { parsedQuery: Query[], query: QueryResults, analyzer: ReadonlyFlowrAnalysisProvider }> {
	const query = remainingArgs.shift();

	if(!query) {
		output.stderr('No query provided, use \':query help\' to get more information.');
		return;
	}
	if(query === 'help') {
		printHelp(output);
		return;
	}

	let parsedQuery: Query[];
	let input: string | undefined;
	if(query.startsWith('@')) {
		const queryName = query.slice(1);
		const queryObj = SupportedQueries[queryName as keyof typeof SupportedQueries] as SupportedQuery;
		if(queryObj?.fromLine) {
			const parseResult = queryObj.fromLine(output, remainingArgs, analyzer.flowrConfig);
			const q = parseResult.query;
			parsedQuery = q ? (Array.isArray(q) ? q : [q]) : [];
			input = parseResult.rCode;
		} else {
			parsedQuery = [{ type: query.slice(1) as SupportedQueryTypes } as Query];
			input = remainingArgs.join(' ').trim();
		}
		if(!validateQueries(output, parsedQuery)) {
			return;
		}
	} else if(query.startsWith('[')) {
		parsedQuery = JSON.parse(query) as Query[];
		if(!validateQueries(output, parsedQuery)) {
			return;
		}
		input = remainingArgs.join(' ').trim();
	} else {
		parsedQuery = [{ type: 'call-context', callName: query }];
	}

	if(input) {
		if(looksLikePath(input)) {
			output.stdout(ansiInfo(`'${input}' looks like a path. To analyze it, use ${bold(fileProtocol + input, output.formatter)} (or ${bold(watchProtocol + input, output.formatter)} to re-run on changes). Use ${bold(':help', output.formatter)} for more.`));
		}
		// reuse a prior analysis (e.g. a dataflow from :df#) when the target is unchanged
		if(!analyzerHasTarget(analyzer, input)) {
			analyzer.reset();
			analyzer.addRequest(input);
		}
	}

	return {
		query: await executeQueries({
			analyzer,
		},
		parsedQuery),
		parsedQuery,
		analyzer
	};
}

/**
 * Function for splitting the input line.
 * All input is treated as arguments, no R code is separated so that the individual queries can handle it.
 * @param line - The input line
 */
function parseArgs(line: string) {
	const args = splitAtEscapeSensitive(line);
	return {
		rCode:     undefined,
		remaining: args
	};
}

export const queryCommand: ReplCodeCommand = {
	description:   'Query the given R code (use \'help\' for more information)',
	isCodeCommand: true,
	usageExample:  ':query "<query>" <code>',
	aliases:       [],
	script:        false,
	argsParser:    parseArgs,
	fn:            async({ output, analyzer, remainingArgs }) => {
		const totalStart = Date.now();
		const results = await processQueryArgs(output, analyzer, remainingArgs);
		const totalEnd = Date.now();
		if(results) {
			output.stdout(await asciiSummaryOfQueryResult(ansiFormatter, totalEnd - totalStart, results.query, results.analyzer, results.parsedQuery));
		}
	}
};

export const queryStarCommand: ReplCodeCommand = {
	description:   'Similar to query, but returns the output in json format.',
	isCodeCommand: true,
	usageExample:  ':query* <query> <code>',
	aliases:       [],
	script:        false,
	argsParser:    parseArgs,
	fn:            async({ output, analyzer, remainingArgs }) => {
		const results = await processQueryArgs(output, analyzer, remainingArgs);
		if(results) {
			const json = Record.map(results.query, ([query, queryResults]: [SupportedQueryTypes, BaseQueryResult]) =>
				[query, (SupportedQueries[query] as SupportedQuery)?.jsonFormatter?.(queryResults) ?? queryResults]
			);
			output.stdout(JSON.stringify(json, jsonReplacer));
		}
	}
};
