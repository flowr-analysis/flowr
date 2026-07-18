import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
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
 * a glob (`3.*`), or a semver range (`>=3.0.0`, `3.x`). With no `package` it summarizes the loaded databases;
 * a single exact package/function yields the full view (signature, definition location, CRAN-mirror source link,
 * rdrr.io docs); a wildcard yields the matching set.
 */
export interface SignatureQuery extends BaseQueryFormat {
	readonly type:      'signature';
	/** the package to inspect (glob wildcards allowed); omit for a summary of the loaded databases */
	readonly package?:  string;
	/** the function/symbol within {@link package} to inspect (glob wildcards allowed) */
	readonly function?: string;
	/** a version spec: an exact version, a glob (`3.*`), or a semver range (`>=3.0.0`, `3.x`) */
	readonly version?:  string;
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
	/** rdrr.io documentation link for the function, when it maps to a documentable topic */
	readonly docUrl?:    string;
	/** whether the function looks like an S3 generic (has `<generic>.<class>` dispatch targets in the same package) */
	readonly s3generic?: boolean;
	/** the `<generic>.<class>` dispatch targets found in the same package */
	readonly s3methods?: readonly string[];
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
	readonly package:    string;
	readonly name:       string;
	readonly exported:   boolean;
	readonly version?:   string;
	readonly file?:      string;
	readonly line?:      number;
	readonly sourceUrl?: string;
	readonly docUrl?:    string;
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
	/** set when a single package was requested and found */
	readonly package?:     SignaturePackageView;
	/** set when a single function was requested and found */
	readonly function?:    SignatureFunctionView;
	/** function hits from a wildcard search */
	readonly matches?:     readonly SignatureMatchView[];
	readonly matchCount?:  number;
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
	const positional = line.filter(t => t.length > 0 && !t.startsWith('--'));
	if(positional[0] === 'help' || line.includes('--help') || line.includes('-h')) {
		printSignatureHelp(output);
		return { query: [] };
	}
	const [first, second] = positional;
	if(!first) {
		return { query: [{ type: 'signature' }] };
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
			...(version ? { version } : {})
		}]
	};
}

export const SignatureQueryDefinition = {
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
		type:     Joi.string().valid('signature').required().description('The type of the query.'),
		package:  Joi.string().optional().description('The package to inspect (glob wildcards allowed); omit for a summary of the loaded databases.'),
		function: Joi.string().optional().description('A function/symbol to inspect (glob wildcards allowed).'),
		version:  Joi.string().optional().description('A version spec: an exact version, a glob (3.*), or a semver range (>=3.0.0, 3.x).')
	}).description('Inspects the loaded signature database(s): loaded databases, a package, a function, or wildcard matches.'),
	flattenInvolvedNodes: (): NodeId[] => []
} as const satisfies SupportedQuery<'signature'>;
