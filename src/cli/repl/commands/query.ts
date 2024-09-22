import type { RShell } from '../../../r-bridge/shell';
import { PipelineExecutor } from '../../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import type { ReplCommand, ReplOutput } from './main';
import { splitAtEscapeSensitive } from '../../../util/args';
import type { OutputFormatter } from '../../../util/ansi';
import { italic , bold  } from '../../../util/ansi';

async function getDataflow(shell: RShell, remainingLine: string) {
	return await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps();
}

interface QueryPattern {
	readonly description: string;
	readonly pattern:     string;
	/* TODO: result */
	readonly call:        (formatter: OutputFormatter, args: readonly string[]) => Promise<void>;
}

function trimWithIndent(str: string, length: number, indent: number): string {
	// split str into lines of length max length, then join them with the given indent
	const lines = [];
	const effictveLength = Math.max(Math.min(length , length - indent), 50);
	for(let i = 0; i < str.length; i += effictveLength) {
		lines.push(str.slice(i, i + effictveLength));
	}
	return lines.join('\n' + ' '.repeat(indent));
}

const AvailableQueries = {
	'help': {
		description: 'Get help on the available queries',
		pattern:     ':query help',
		// eslint-disable-next-line @typescript-eslint/require-await
		call:        async f => {
			console.log('Available queries:');
			for(const [query, { description, pattern }] of Object.entries(AvailableQueries)) {
				console.log(`- [${bold(query, f)}] ${italic(pattern, f)}\n${' '.repeat(query.length + 5)}${trimWithIndent(description, 120, query.length + 5)}`);
			}
		}
	},
	'call': {
		description: 'Call-Context Query (retrieve all calls matching your criteria). The criteria is to be a regex of the callName you are interested in. ',
		pattern:     ':query  <code>',
		// eslint-disable-next-line @typescript-eslint/require-await
		call:        async(f, args) => {
			console.log('Call-Context Query:', args);
		}
	},
} as const satisfies Record<string, QueryPattern>;

async function processQueryArgs(line: string, shell: RShell, output: ReplOutput): Promise<void> {
	const args = splitAtEscapeSensitive(line);
	const query = args.shift();

	if(!query) {
		output.stderr('No query provided, use \':query help\' to get more information.');
		return;
	}

	const queryPattern = AvailableQueries[query as keyof typeof AvailableQueries];
	if(!queryPattern) {
		output.stderr(`Unknown query: ${query}, use ':query help' to get more information.`);
		return;
	}

	return await queryPattern.call(output.formatter, args);
}

export const queryCommand: ReplCommand = {
	description:  `Query the given R code, start with '${fileProtocol}' to indicate a file. Use the 'help' query to get more information!`,
	usageExample: ':query <query> <code>',
	aliases:      [],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		await processQueryArgs(remainingLine, shell, output);
	}
};

export const queryStarCommand: ReplCommand = {
	description:  'Similar to query, but returns the output in json format.',
	usageExample: ':query* <query> <code>',
	aliases:      [ ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		/* TODO */
		await processQueryArgs(remainingLine, shell, output);
	}
};
