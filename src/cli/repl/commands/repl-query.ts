import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { ansiFormatter, ansiInfo, bold, ColorEffect, Colors, italic, faint, supportsHyperlinks } from '../../../util/text/ansi';
import {
	executeQueries,
	type Query,
	queryWikiPage,
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
import { requestFromInput } from '../../../r-bridge/retriever';
import { handlePathLikeInput } from '../path-input';

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
	output.stdout(`Start with '?<type>' instead to see documentation on a query, e.g. ${bold(':query ?guess-dep-versions', output.formatter)} (a bare ${bold(':query ?', output.formatter)} lists them all).`);
	output.stdout(`With this, ${bold(':query @config', output.formatter)} prints the result of the config query.`);
	output.stdout(`If you want to run the linter on a project use:\n    ${bold(':query @linter file://<path>', output.formatter)} (or ${bold('watch://<path>', output.formatter)} to re-run on changes).`);
	output.stdout(ansiInfo('Otherwise, you can also directly pass the query json. Then, the query is an array of query objects to represent multiple queries.'));
	output.stdout(ansiInfo('The example') + italic(String.raw`:query "[{\"type\": \"call-context\", \"callName\": \"mean\" }]" mean(1:10)`, output.formatter, { color: Colors.White, effect: ColorEffect.Foreground }) + ansiInfo('would return the call context of the mean function.'));
	output.stdout('Please have a look at the wiki for more info: https://github.com/flowr-analysis/flowr/wiki/Query-API');
}

/** one parameter of a query, as returned by Joi's loosely-typed {@link Joi.ObjectSchema.describe} */
interface QueryParamDescription {
	readonly type?:  string;
	readonly flags?: { readonly presence?: string, readonly description?: string };
	readonly allow?: readonly unknown[];
}
/** the described shape of a query's Joi schema (its own description plus its parameters) */
interface QuerySchemaDescription {
	readonly flags?: { readonly description?: string };
	readonly keys?:  Record<string, QueryParamDescription>;
}

/** the single boundary cast for Joi's untyped {@link Joi.Description}, shared by the doc and template renderers */
function describeSchema(schema: SupportedQuery['schema']): QuerySchemaDescription {
	return schema.describe() as unknown as QuerySchemaDescription;
}

/** Print documentation for one query type from its Joi schema (description + each parameter), or list all when no name is given. */
function printQueryDoc(output: ReplOutput, name: string): void {
	if(name.length === 0) {
		output.stdout(`Queries: ${Object.keys(SupportedQueries).sort().map(q => bold('@' + q, output.formatter)).join(', ')}`);
		output.stdout(`Use ${bold(':query ?<type>', output.formatter)} for details on one, e.g. ${bold(':query ?guess-dep-versions', output.formatter)}.`);
		return;
	}
	const def = Object.entries(SupportedQueries).find(([key]) => key === name)?.[1];
	if(def === undefined) {
		output.stderr(`Unknown query ${italic(name, output.formatter)}; use ${bold(':query ?', output.formatter)} to list every query.`);
		return;
	}
	const desc = describeSchema(def.schema);
	output.stdout(`${bold('@' + name, output.formatter)}${desc.flags?.description ? ` ${faint('— ' + desc.flags.description, output.formatter)}` : ''}`);
	const params = Object.entries(desc.keys ?? {}).filter(([key]) => key !== 'type');
	if(params.length === 0) {
		output.stdout(faint('  (no parameters)', output.formatter));
	}
	for(const [key, spec] of params) {
		const presence = spec.flags?.presence === 'required' ? 'required' : 'optional';
		const allowed = Array.isArray(spec.allow) && spec.allow.length > 0 ? ` {${spec.allow.join('|')}}` : '';
		output.stdout(`  ${bold(key, output.formatter)} ${faint(`(${spec.type}${allowed}, ${presence})`, output.formatter)}${spec.flags?.description ? ': ' + spec.flags.description : ''}`);
	}
	const syntax = 'syntax' in def && typeof def.syntax === 'string' ? def.syntax : `@${name} <code | file://path>`;
	output.stdout(`Run: ${bold(':query ' + syntax, output.formatter)}`);
	output.stdout(`JSON: ${italic(queryTemplate(name, def.schema), output.formatter)}`);
	const wiki = `https://github.com/flowr-analysis/flowr/wiki/${encodeURIComponent(queryWikiPage(def.title).replaceAll(' ', '-'))}`;
	output.stdout(`Docs: ${supportsHyperlinks() ? output.formatter.hyperlink(`${name} query`, wiki) : wiki}`);
}

/** A copy-pasteable JSON template for a query type: its `type` plus each required field as a placeholder. */
function queryTemplate(type: string, schema: SupportedQuery['schema']): string {
	const keys = describeSchema(schema).keys ?? {};
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
	// `?<type>` (or `? <type>`) documents a query instead of running it; a bare `?` lists them all
	if(query.startsWith('?')) {
		printQueryDoc(output, query.slice(1) || (remainingArgs.shift() ?? ''));
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
		input = handlePathLikeInput(output, input, analyzer.flowrConfig);
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
