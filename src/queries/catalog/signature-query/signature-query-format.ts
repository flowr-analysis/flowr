import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { ShardStatus } from '../../../project/sigdb/reader';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, italic, color, Colors } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { executeSignatureQuery, signatureQueryCompleter } from './signature-query-executor';
import { printSignatureHelp, pushFunction, pushPackage, pushMatches, pushPackages, pushSummary } from './signature-query-render';

/**
 * Inspects the loaded signature database(s) (see the {@link https://github.com/flowr-analysis/flowr/wiki/Signature-Database|Signature Database wiki}).
 * The `package` and `function` fields accept glob wildcards (`*`, `?`), and `version` accepts an exact version,
 * a glob (`3.*`), a semver range (`>=3.0.0`, `3.x`), or a release-date bound (`<=2026`, `>=2021.05`, YYYY.MM.DD).
 * With no `package` it summarizes the loaded databases; a single exact package/function yields the full view
 * (signature, definition location, CRAN-mirror source link); a wildcard yields the matching set. `parameters` and `requiredParameters` further filter to
 * functions that have a parameter matching *every* given name (position-independent) or an exact required-parameter
 * count (a parameter filter alone, e.g. `--param fuzz`, searches every package; repeat `--param` or comma-separate
 * to require several, e.g. `--param data --param mapping`).
 */
export interface SignatureQuery extends BaseQueryFormat {
	readonly type:                'signature';
	/** the package to inspect (glob wildcards allowed); omit for a summary of the loaded databases */
	readonly package?:            string;
	/** the function/symbol within {@link package} to inspect (glob wildcards allowed) */
	readonly function?:           string;
	/** a version spec: an exact version, a glob (`3.*`), a semver range (`>=3.0.0`, `3.x`), or a release-date bound (`<=2026`, `>=2021.05` in YYYY.MM.DD) */
	readonly version?:            string;
	/** keep only functions that have a parameter matching *every* one of these names (glob wildcards allowed, position-independent, e.g. `fuzz`, `.*data`) */
	readonly parameters?:         readonly string[];
	/** keep only functions with exactly this many required (no-default) parameters, excluding `...` */
	readonly requiredParameters?: number;
	/** for a single function, also render its transitive call graph as a mermaid.live link (`--cg`) */
	readonly callGraph?:          boolean;
}

/** one parameter of a function signature */
export interface SignatureParameterView {
	readonly name:     string;
	readonly required: boolean;
	readonly forced:   boolean;
	readonly default?: string;
}

/** the detailed view of a single function within a package */
export interface SignatureFunctionView {
	readonly name:       string;
	readonly package:    string;
	readonly version?:   string;
	readonly exported:   boolean;
	readonly properties: readonly string[];
	readonly parameters: readonly SignatureParameterView[];
	readonly callees:    readonly string[];
	readonly file?:      string;
	readonly line?:      number;
	/** deep link into the read-only CRAN GitHub mirror, when the definition location + a CRAN version are known */
	readonly sourceUrl?: string;
	/** best-effort rdrr.io documentation link, when the function name maps to a documentable topic */
	readonly docUrl?:    string;
	/** whether the function looks like an S3 generic (has `<generic>.<class>` dispatch targets in the same package) */
	readonly s3generic?: boolean;
	/** the `<generic>.<class>` dispatch targets found in the same package */
	readonly s3methods?: readonly string[];
	/** when the function is an S3 method, the generic it dispatches for (`print.rema` is `print` in `base`, class `rema`); lazily computed */
	readonly s3method?:  { readonly generic: string, readonly class: string, readonly package: string };
	/** a mermaid.live link visualizing the transitive call graph from this function (only when requested with `--cg`) */
	readonly callGraph?: string;
}

/** one declared dependency of a package */
export interface SignatureDependencyView {
	readonly type:        string;
	readonly name:        string;
	readonly constraint?: string;
}

/** the full view of a package as stored in the signature database */
export interface SignaturePackageView {
	readonly name:          string;
	readonly version:       string;
	/** the version the analyzer resolved the package to, if it differs from {@link version} */
	readonly resolved?:     string;
	readonly base:          boolean;
	readonly cran:          boolean;
	/** the CRAN source tarball url, when known */
	readonly cranUrl?:      string;
	/** the CRAN package landing page (`cran.r-project.org/package=<pkg>`), for CRAN packages */
	readonly cranPage?:     string;
	/** the package's read-only CRAN GitHub mirror (`github.com/cran/<pkg>`), for CRAN packages */
	readonly repoUrl?:      string;
	readonly releaseDate?:  string;
	readonly exportsTotal:  number;
	readonly functionCount: number;
	readonly constants:     readonly string[];
	readonly internalCount: number;
	readonly deprecated:    readonly string[];
	/** for a base package: the R releases it was part of core, ascending */
	readonly coreVersions?: readonly string[];
	readonly dependencies:  readonly SignatureDependencyView[];
	readonly functions:     readonly SignatureFunctionView[];
}

/** a compact hit from a wildcard function search */
export interface SignatureMatchView {
	readonly package:            string;
	readonly name:               string;
	readonly exported:           boolean;
	readonly version?:           string;
	readonly file?:              string;
	readonly line?:              number;
	readonly sourceUrl?:         string;
	/** best-effort rdrr.io documentation link, when the function name maps to a documentable topic */
	readonly docUrl?:            string;
	/** a preview of the function's parameters (the ones a parameter/required filter matched first), when such a filter is active */
	readonly parameters?:        readonly string[];
	/** the subset of {@link parameters} that the `--param` filter actually matched, so the renderer can highlight them */
	readonly matchedParameters?: readonly string[];
}

/** a hit from a wildcard package search */
export interface SignaturePackageMatch {
	readonly name:      string;
	readonly base:      boolean;
	readonly cran:      boolean;
	readonly latest?:   string;
	/** the versions matching the version spec (present only for a versioned search) */
	readonly versions?: readonly string[];
	readonly cranPage?: string;
}

/** metadata of one loaded signature database */
export interface SignatureDatabaseView {
	readonly scope:   string;
	readonly version: number;
	readonly date:    string;
}

export interface SignatureQueryResult extends BaseQueryResult {
	readonly databases:    readonly SignatureDatabaseView[];
	readonly packageCount: number;
	readonly sourceCount:  number;
	/** per-shard load state of the sharded sources (which shards this session has opened and unpacked); summary only */
	readonly shards?:      readonly ShardStatus[];
	/** set when a single package was requested and found */
	readonly package?:     SignaturePackageView;
	/** set when a single function was requested and found */
	readonly function?:    SignatureFunctionView;
	/** function hits from a wildcard search */
	readonly matches?:     readonly SignatureMatchView[];
	readonly matchCount?:  number;
	/** how many functions the search examined against the filters (only interesting when it exceeds the hit count) */
	readonly searched?:    number;
	/** whether the search covered only the latest version of each package, so historical releases were skipped */
	readonly latestOnly?:  boolean;
	/** package hits from a wildcard package search (no function given) */
	readonly packages?:    readonly SignaturePackageMatch[];
	/** whether the match list was capped */
	readonly truncated?:   boolean;
	/** a not-found / disabled note, with optional near-match suggestions */
	readonly message?:     string;
	readonly suggestions?: readonly string[];
}

/** parse a signature-query repl line into a query: `pkg`, `pkg fn`, `pkg::fn`, `pkg@ver`, globs */
function signatureQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'signature'> {
	// pull the `--param <name>` (repeatable, comma-separable) / `--required <n>` flags out, leaving the positional tokens
	const parameters: string[] = [];
	let requiredParameters: number | undefined;
	let callGraph = false;
	const positional: string[] = [];
	for(let i = 0; i < line.length; i++) {
		const tok = line[i];
		if(tok.length === 0) {
			continue;
		}
		if(tok === '--param' || tok === '-p') {
			parameters.push(...(line[++i] ?? '').split(',').map(s => s.trim()).filter(s => s.length > 0));
		} else if(tok === '--required' || tok === '--req') {
			requiredParameters = Number(line[++i]);
		} else if(tok === '--cg') {
			callGraph = true;
		} else if(!tok.startsWith('--')) {
			positional.push(tok);
		}
	}
	// help only when it is the leading word or an explicit flag -- never for a package/function literally named `help`
	if(positional[0] === 'help' || line.includes('--help') || line.includes('-h')) {
		printSignatureHelp(output);
		return { query: [] };
	}
	const paramFilters = {
		...(parameters.length > 0 ? { parameters } : {}),
		...(requiredParameters !== undefined && !Number.isNaN(requiredParameters) ? { requiredParameters } : {}),
		...(callGraph ? { callGraph: true } : {})
	};
	const hasParamFilter = parameters.length > 0 || (requiredParameters !== undefined && !Number.isNaN(requiredParameters));
	const [first, second] = positional;
	if(!first) {
		// a bare parameter filter (`--param fuzz`) searches every package; otherwise summarize the databases
		return { query: [{ type: 'signature', ...(hasParamFilter ? { package: '*' } : {}), ...paramFilters }] };
	}
	// `pkg::fn` shorthand, then `pkg@version`
	const dbl = first.indexOf('::');
	const left = dbl >= 0 ? first.slice(0, dbl) : first;
	const fnFromColon = dbl >= 0 ? first.slice(dbl + 2) : undefined;
	const at = left.indexOf('@');
	const pkg = at >= 0 ? left.slice(0, at) : left;
	const version = at >= 0 ? left.slice(at + 1) : undefined;
	const fn = second ?? fnFromColon;
	return {
		query: [{
			type: 'signature',
			...(pkg ? { package: pkg } : {}),
			...(fn ? { function: fn } : {}),
			...(version ? { version } : {}),
			...paramFilters
		}]
	};
}

export const SignatureQueryDefinition = {
	title:           'Signature Query',
	executor:        executeSignatureQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result, _query) => {
		const out = queryResults as QueryResults<'signature'>['signature'];
		result.push(`Query: ${bold('signature', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		if(out.function) {
			pushFunction(result, formatter, out.function);
		} else if(out.package) {
			pushPackage(result, formatter, out.package);
		} else if(out.matches) {
			pushMatches(result, formatter, out);
		} else if(out.packages) {
			pushPackages(result, formatter, out);
		} else if(!out.message) {
			pushSummary(result, formatter, out);
		}
		if(out.message) {
			const hint = out.suggestions?.length ? ` ${italic('Did you mean:', formatter)} ${out.suggestions.join(', ')}?` : '';
			result.push(`   ╰ ${color(out.message, Colors.Red, formatter)}${hint}`);
		}
		return true;
	},
	fromLine:  signatureQueryLineParser,
	completer: signatureQueryCompleter,
	schema:    Joi.object({
		type:               Joi.string().valid('signature').required().description('The type of the query.'),
		package:            Joi.string().optional().description('The package to inspect (glob wildcards allowed); omit for a summary of the loaded databases.'),
		function:           Joi.string().optional().description('A function/symbol to inspect (glob wildcards allowed).'),
		version:            Joi.string().optional().description('A version spec: an exact version, a glob (3.*), a semver range (>=3.0.0, 3.x), or a release-date bound (<=2026, >=2021.05 in YYYY.MM.DD).'),
		parameters:         Joi.array().items(Joi.string()).optional().description('Keep only functions that have a parameter matching every one of these names (glob wildcards allowed, position-independent).'),
		requiredParameters: Joi.number().integer().min(0).optional().description('Keep only functions with exactly this many required (no-default) parameters, excluding `...`.'),
		callGraph:          Joi.boolean().optional().description('For a single function, also render its transitive call graph as a mermaid.live link (`--cg`).')
	}).description('Inspects the loaded signature database(s): loaded databases, a package, a function, or wildcard matches (optionally filtered by parameter name or required-parameter count).'),
	flattenInvolvedNodes: (): NodeId[] => []
} as const satisfies SupportedQuery<'signature'>;
