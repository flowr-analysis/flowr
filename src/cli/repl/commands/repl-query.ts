import { fileProtocol } from '../../../r-bridge/retriever';
import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { ansiFormatter, italic } from '../../../util/text/ansi';
import { describeSchema } from '../../../util/schema';
import type { Query, QueryResults, SupportedQuery, SupportedQueryTypes } from '../../../queries/query';
import { AnyQuerySchema, executeQueries, QueriesSchema, SupportedQueries } from '../../../queries/query';
import { jsonReplacer } from '../../../util/json';
import { asciiSummaryOfQueryResult } from '../../../queries/query-print';
import type { FlowrAnalysisProvider } from '../../../project/flowr-analyzer';


function printHelp(output: ReplOutput) {
	output.stderr(`Format: ${italic(':query "<query>" <code>', output.formatter)}`);
	output.stdout('The query is an array of query objects to represent multiple queries. Each query object may have the following properties:');
	output.stdout(describeSchema(AnyQuerySchema(), output.formatter));
	output.stdout(`\n\nThe example ${italic(':query "[{\\"type\\": \\"call-context\\", \\"callName\\": \\"mean\\" }]" mean(1:10)', output.formatter)} would return the call context of the mean function.`);
	output.stdout('As a convenience, we interpret any (non-help, non-@) string not starting with \'[\' as a regex for the simple call-context query.');
	output.stdout(`Hence, ${italic(':query "mean" mean(1:10)', output.formatter)} is equivalent to the above example.`);
	output.stdout('Similarly, \'@<type>\' is interpreted as a query of the given type.');
	output.stdout(`With this, ${italic(':query @config', output.formatter)} prints the result of the config query.`);
}

async function processQueryArgs(output: ReplOutput, analyzer: FlowrAnalysisProvider, remainingArgs: string[]): Promise<undefined | { parsedQuery: Query[], query: QueryResults, analyzer: FlowrAnalysisProvider }> {
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
	if(query.startsWith('@')) {
		const queryName = query.slice(1);
		const queryObj = SupportedQueries[queryName as keyof typeof SupportedQueries] as SupportedQuery;
		if(queryObj?.fromLine) {
			const q = queryObj.fromLine(remainingArgs, analyzer.flowrConfig);
			parsedQuery = q ? (Array.isArray(q) ? q : [q]) : [];
		} else {
			parsedQuery = [{ type: query.slice(1) as SupportedQueryTypes } as Query];
		}
		const validationResult = QueriesSchema().validate(parsedQuery);
		if(validationResult.error) {
			output.stderr(`Invalid query: ${validationResult.error.message}`);
			printHelp(output);
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
	} else {
		parsedQuery = [{ type: 'call-context', callName: query }];
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
 * The first token is the query command.
 * The rest of the line is treated as input code.
 */
function parseArgs(line: string) {
	const args = splitAtEscapeSensitive(line);
	return {
		input:     args.join(' ').trim(),
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
			output.stdout(JSON.stringify(results.query, jsonReplacer));
		}
	}
};
