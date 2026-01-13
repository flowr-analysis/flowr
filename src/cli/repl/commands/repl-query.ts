import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { ansiFormatter, ansiInfo, bold, ColorEffect, Colors, FontStyles, italic } from '../../../util/text/ansi';
import {
	executeQueries,
	QueriesSchema,
	type Query,
	type QueryResults,
	SupportedQueries,
	type SupportedQuery,
	type SupportedQueryTypes
} from '../../../queries/query';
import type { FlowrAnalysisProvider, ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { fileProtocol } from '../../../r-bridge/retriever';
import { asciiSummaryOfQueryResult } from '../../../queries/query-print';
import { jsonReplacer } from '../../../util/json';
import type { BaseQueryResult } from '../../../queries/base-query-format';
import { splitAtEscapeSensitive } from '../../../util/text/args';


function printHelp(output: ReplOutput) {
	output.stderr(`Format: ${italic(':query <query> <code>', output.formatter)}`);
	output.stdout('Queries starting with \'@<type>\' are interpreted as a query of the given type.');
	output.stdout(`With this, ${bold(':query @config', output.formatter)} prints the result of the config query.`);
	output.stdout(`If you want to run the linter on a project use:\n    ${bold(':query @linter file://<path>', output.formatter)}.`);
	output.stdout(ansiInfo('Otherwise, you can also directly pass the query json. Then, the query is an array of query objects to represent multiple queries.'));
	output.stdout(ansiInfo('The example') + italic(String.raw`:query "[{\"type\": \"call-context\", \"callName\": \"mean\" }]" mean(1:10)`, output.formatter, { color: Colors.White, effect: ColorEffect.Foreground }) + ansiInfo('would return the call context of the mean function.'));
	output.stdout('Please have a look at the wiki for more info: https://github.com/flowr-analysis/flowr/wiki/Query-API');
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
		const validationResult = QueriesSchema().validate(parsedQuery);
		if(validationResult.error) {
			output.stderr(`Invalid query: "${output.formatter.format(JSON.stringify(parsedQuery), { style: FontStyles.Italic, color: Colors.Yellow, effect: ColorEffect.Foreground })}"`);
			for(const line of validationResult.error.details) {
				const value = line.context?.value ? JSON.stringify(line.context.value) : undefined;
				output.stderr(` - ${line.message} ${value ? '(' + italic(value, output.formatter) + ')' : ''}`);
				const ctx = line.context as { details?: Array<{ message: string }> } | undefined;
				for(const detail of ctx?.details?.slice(0, ctx.details.length - 1) ?? []) {
					if('context' in detail && 'message' in (detail.context as object)) {
						const lines = (detail.context as { message: string }).message.split('. ');
						for(const l of lines) {
							output.stderr(`   - ${l.trim()}`);
						}
					}
				}
			}
			return;
		}
	} else if(query.startsWith('[')) {
		parsedQuery = JSON.parse(query) as Query[];
		const validationResult = QueriesSchema().validate(parsedQuery);
		if(validationResult.error) {
			output.stderr(`Invalid query: ${validationResult.error.message}`);
			printHelp(output);
			return;
		}
		input = remainingArgs.join(' ').trim();
	} else {
		parsedQuery = [{ type: 'call-context', callName: query }];
	}

	if(input) {
		analyzer.reset();
		analyzer.addRequest(input);
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
	description:   `Query the given R code, start with '${fileProtocol}' to indicate a file. The query is to be a valid query in json format (use 'help' to get more information).`,
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
			const json = Object.fromEntries(Object.entries(results.query)
				.map(([query, queryResults]) => [query, (SupportedQueries[query as SupportedQueryTypes] as SupportedQuery)?.jsonFormatter?.(queryResults as BaseQueryResult) ?? queryResults]));
			output.stdout(JSON.stringify(json, jsonReplacer));
		}
	}
};
