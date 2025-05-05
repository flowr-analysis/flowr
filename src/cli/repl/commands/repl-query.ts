import type { DEFAULT_DATAFLOW_PIPELINE } from '../../../core/steps/pipeline/default-pipelines';
import { createDataflowPipeline } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import type { ReplCommand, ReplOutput } from './repl-main';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { ansiFormatter, italic } from '../../../util/text/ansi';
import { describeSchema } from '../../../util/schema';
import type { Query, QueryResults, SupportedQueryTypes } from '../../../queries/query';
import { AnyQuerySchema, QueriesSchema , executeQueries } from '../../../queries/query';
import type { PipelineOutput } from '../../../core/steps/pipeline/pipeline';
import { jsonReplacer } from '../../../util/json';
import { asciiSummaryOfQueryResult } from '../../../queries/query-print';
import type { KnownParser } from '../../../r-bridge/parser';
import type { FlowrConfigOptions } from '../../../config';


async function getDataflow(config: FlowrConfigOptions, parser: KnownParser, remainingLine: string) {
	return await createDataflowPipeline(parser, {
		request: requestFromInput(remainingLine.trim())
	}, config).allRemainingSteps();
}


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

async function processQueryArgs(config: FlowrConfigOptions, line: string, parser: KnownParser, output: ReplOutput): Promise<undefined | { query: QueryResults<SupportedQueryTypes>, processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE> }> {
	const args = splitAtEscapeSensitive(line);
	const query = args.shift();

	if(!query) {
		output.stderr('No query provided, use \':query help\' to get more information.');
		return;
	}
	if(query === 'help') {
		printHelp(output);
		return;
	}

	let parsedQuery: Query[] = [];
	if(query.startsWith('@')) {
		parsedQuery = [{ type: query.slice(1) as SupportedQueryTypes } as Query];
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

	const processed = await getDataflow(config, parser, args.join(' '));
	return {
		query: executeQueries({ dataflow: processed.dataflow, ast: processed.normalize }, parsedQuery),
		processed
	};
}

export const queryCommand: ReplCommand = {
	description:  `Query the given R code, start with '${fileProtocol}' to indicate a file. The query is to be a valid query in json format (use 'help' to get more information).`,
	usageExample: ':query "<query>" <code>',
	aliases:      [],
	script:       false,
	fn:           async(config, output, parser, remainingLine) => {
		const totalStart = Date.now();
		const results = await processQueryArgs(config, remainingLine, parser, output);
		const totalEnd = Date.now();
		if(results) {
			output.stdout(asciiSummaryOfQueryResult(ansiFormatter, totalEnd - totalStart, results.query, results.processed));
		}
	}
};

export const queryStarCommand: ReplCommand = {
	description:  'Similar to query, but returns the output in json format.',
	usageExample: ':query* <query> <code>',
	aliases:      [ ],
	script:       false,
	fn:           async(config, output, shell, remainingLine) => {
		const results = await processQueryArgs(config, remainingLine, shell, output);
		if(results) {
			output.stdout(JSON.stringify(results.query, jsonReplacer));
		}
	}
};
