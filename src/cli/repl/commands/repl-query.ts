import type { RShell } from '../../../r-bridge/shell';
import { PipelineExecutor } from '../../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import type { ReplCommand, ReplOutput } from './repl-main';
import { splitAtEscapeSensitive } from '../../../util/args';
import { italic } from '../../../util/ansi';

import { describeSchema } from '../../../util/schema';
import type { Query, QueryResults, SupportedQueryTypes } from '../../../queries/query';
import { asciiSummaryOfQueryResult ,  executeQueries } from '../../../queries/query';

import type { PipelineOutput } from '../../../core/steps/pipeline/pipeline';
import { jsonReplacer } from '../../../util/json';
import { AnyQuerySchema, QueriesSchema } from '../../../queries/query-schema';


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
