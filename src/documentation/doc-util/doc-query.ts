import type { RShell } from '../../r-bridge/shell';
import type { Queries, SupportedQuery, SupportedQueryTypes } from '../../queries/query';
import { queryWikiPage, SupportedQueries } from '../../queries/query';
import { SupportedVirtualQueries } from '../../queries/virtual-query/virtual-queries';
import { autoGenHeader } from './doc-auto-gen';
import { section } from './doc-structure';
import { guard } from '../../util/assert';
import path from 'path';
import { jsonReplacer } from '../../util/json';
import { markdownFormatter } from '../../util/text/ansi';
import { FlowrWikiBaseRef, getFilePathMd } from './doc-files';
import type { SupportedVirtualQueryTypes } from '../../queries/virtual-query/virtual-queries';
import type { VirtualCompoundConstraint } from '../../queries/virtual-query/compound-query';
import { printDfGraphForCode } from './doc-dfg';
import { codeBlock, jsonWithLimit } from './doc-code';
import { printAsMs } from '../../util/text/time';
import { asciiSummaryOfQueryResult } from '../../queries/query-print';
import { FlowrAnalyzerBuilder } from '../../project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../project/context/flowr-file';
import { getReplCommand } from './doc-cli-option';
import type { SlicingCriteria } from '../../slicing/criterion/parse';
import type { GeneralDocContext } from '../wiki-mk/doc-context';
import type { KnownParser } from '../../r-bridge/parser';

const QueryDocFile = 'src/documentation/wiki-query.ts';

export interface ShowQueryOptions {
	readonly showCode?:       boolean;
	readonly collapseResult?: boolean;
	readonly collapseQuery?:  boolean;
	readonly shorthand?:      string;
	readonly ctx?:            GeneralDocContext;
	/** additional in-memory files registered before the request, e.g. the targets of `source(...)` calls */
	readonly files?:          readonly { readonly name: string, readonly content: string }[];
}

/**
 * Visualizes a query and its results in markdown format.
 */
export async function showQuery<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(
	parser: KnownParser, code: string,
	queries: Queries<Base, VirtualArguments>,
	{ showCode, collapseResult, collapseQuery, shorthand, ctx, files }: ShowQueryOptions = {}
): Promise<string> {
	const now = performance.now();
	const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
	for(const file of files ?? []) {
		analyzer.addFile(new FlowrInlineTextFile(file.name, file.content));
	}
	analyzer.addRequest(code);
	const results = await analyzer.query(queries);
	const duration = performance.now() - now;

	const metaInfo = `
The analysis required _${printAsMs(duration)}_ (including parsing and normalization and the query) within the generation environment.
	`.trim();

	const str = JSON.stringify(queries, jsonReplacer, collapseQuery ? ' ' : 2);
	return `

${codeBlock('json', collapseQuery ? str.split('\n').join(' ').replace(/([{[])\s{2,}/g, '$1 ').replace(/\s{2,}([\]}])/g, ' $1') : str)}

${(function() {
	if((queries.length === 1 && Object.keys(queries[0]).length === 1) || shorthand) {
		return `(This can be shortened to \`@${queries[0].type}${shorthand ? ' ' + shorthand : ''}\` when used with the REPL command ${getReplCommand('query')}).`;
	} else {
		return '';
	}
})()}

${collapseResult ? ' <details> <summary style="color:gray">Show Results</summary>' : ''}

_Results (prettified and summarized):_

${
	await asciiSummaryOfQueryResult(markdownFormatter, duration, results, analyzer, queries)
}

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

${metaInfo}

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the ${ctx ? ctx.linkPage('wiki/Interface', 'Interface') : `[Interface](${FlowrWikiBaseRef}/Interface)`} wiki page for more information on how to get those.

${jsonWithLimit(results)}

</details>

${
	showCode ? `
<details> <summary style="color:gray">Original Code</summary>

${await printDfGraphForCode(parser, code, { switchCodeAndGraph: true })}

</details>
	` : ''
}

${collapseResult ? '</details>' : ''}

	`;

}

export interface QueryDocumentation {
	/** only for virtual queries, active ones carry their {@link SupportedQuery.title} */
	readonly name?:            string;
	readonly type:             'virtual' | 'active';
	readonly shortDescription: string;
	readonly functionName:     string;
	/** Path to the file implementing the query function, the wiki generation will fail if this isn't found */
	readonly functionFile:     string;
	readonly buildExplanation: (shell: RShell, ctx: GeneralDocContext) => Promise<string>;
}

export const RegisteredQueries = {
	'active':  new Map<string, QueryDocumentation>(),
	'virtual': new Map<string, QueryDocumentation>()
};


/**
 * Registers a new documentation for a query.
 */
export function registerQueryDocumentation(query: SupportedQueryTypes | SupportedVirtualQueryTypes, doc: QueryDocumentation) {
	const map = RegisteredQueries[doc.type];
	if(map.has(query)) {
		throw new Error(`Query ${query} already registered`);
	}
	map.set(query, doc);
}

/**
 * Creates a REPL shorthand for the given slicing criteria and R code (`f` requests a forward slice,
 * `i` inlines resolvable `source()` calls into the reconstruction; the flags may be combined as `fi`).
 */
export function sliceQueryShorthand(criteria: SlicingCriteria, code: string, forward?: boolean, inline?: boolean) {
	return `(${(criteria.join(';'))})${forward ? 'f' : ''}${inline ? 'i' : ''} "${code}"`;
}

/** The display name of a query, from its definition or, for a virtual query, its documentation. */
export function getQueryTitle(id: string): string {
	const title = (SupportedQueries[id as SupportedQueryTypes] as SupportedQuery | undefined)?.title
		?? RegisteredQueries.virtual.get(id)?.name;
	guard(title !== undefined, () => `Query ${id} is not documented!`);
	return title;
}

/** Mirrors the `[Linting Rule] ...` pages, see `getPageNameForLintingRule`. */
export function getPageNameForQuery(id: string): string {
	return queryWikiPage(getQueryTitle(id));
}

function queryPageUrl(id: string): string {
	return `${FlowrWikiBaseRef}/${encodeURIComponent(getPageNameForQuery(id).replaceAll(' ', '-'))}`;
}

/** `linkText` defaults to the query's title. */
export function linkToQueryOfName(id: SupportedQueryTypes | SupportedVirtualQueryTypes, linkText?: string) {
	return `[${linkText ?? getQueryTitle(id)}](${queryPageUrl(id)})`;
}


/**
 *
 */
export function tocForQueryType(type: 'active' | 'virtual') {
	const queries = [...RegisteredQueries[type].keys()].sort((a, b) => getQueryTitle(a).localeCompare(getQueryTitle(b)));
	const result: string[] = [];
	for(const id of queries) {
		result.push(`1. ${linkToQueryOfName(id as SupportedQueryTypes)} (\`${id}\`):\\\n    ${RegisteredQueries[type].get(id)?.shortDescription}`);
	}
	return result.join('\n');
}

async function explainQuery(shell: RShell, ctx: GeneralDocContext, id: string, { shortDescription, functionName, functionFile, buildExplanation }: QueryDocumentation) {
	const name = getQueryTitle(id);
	const syntax = (SupportedQueries[id as SupportedQueryTypes] as SupportedQuery | undefined)?.syntax;
	return `
${autoGenHeader({ filename: QueryDocFile, purpose: 'query API' })}
${section(name + `&emsp;<sup>[<a href="${FlowrWikiBaseRef}/Query-API">overview</a>]</sup>`, 2, name)}

${shortDescription}\\
_This query is requested with the type \`${id}\`._${syntax ? `\\\nRun in the REPL: \`:query ${syntax}\`` : ''}

${await buildExplanation(shell, ctx)}

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the ${name} query is \`${functionName}\` in ${getFilePathMd(functionFile)}.

</details>

`.trim();
}


/** Keyed by the file path each page is written to. */
export async function queryPages(shell: RShell, ctx: GeneralDocContext, type: 'active' | 'virtual'): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	for(const [id, doc] of RegisteredQueries[type].entries()) {
		result[path.join('wiki', `${getPageNameForQuery(id)}.md`)] = await explainQuery(shell, ctx, id, doc);
	}
	return result;
}

/** Without this, a new query would silently end up without a wiki page. */
export function assertAllQueriesDocumented(): void {
	const undocumented = [
		...Object.keys(SupportedQueries).filter(q => !RegisteredQueries.active.has(q)),
		...Object.keys(SupportedVirtualQueries).filter(q => !RegisteredQueries.virtual.has(q))
	];
	guard(undocumented.length === 0, () =>
		`The quer${undocumented.length === 1 ? 'y' : 'ies'} ${undocumented.map(q => `'${q}'`).join(', ')} ${undocumented.length === 1 ? 'has' : 'have'} no documentation! `
		+ `Please add a 'registerQueryDocumentation' entry in ${QueryDocFile}.`);
	const stale = [
		...[...RegisteredQueries.active.keys()].filter(q => !(q in SupportedQueries)),
		...[...RegisteredQueries.virtual.keys()].filter(q => !(q in SupportedVirtualQueries))
	];
	guard(stale.length === 0, () =>
		`The documentation of ${stale.map(q => `'${q}'`).join(', ')} refers to (a) query type(s) that no longer exist(s).`);
}
