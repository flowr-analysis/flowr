import { LintingPrettyPrintContext, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty, type LintQuickFixReplacement } from '../linter-format';
import { RPath } from '../../util/files';
import { compactRecord, type MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation, SourceRange } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { isAbsolutePath, isUrl, fileUrlToPath } from '../../util/text/strings';
import { isNotUndefined } from '../../util/assert';
import { readFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import { writeFunctions } from '../../queries/catalog/dependencies-query/function-info/write-functions';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { SourceFunctions } from '../../queries/catalog/dependencies-query/function-info/source-functions';
import { type DataflowGraphVertexFunctionCall, DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import type { QueryResults } from '../../queries/query';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { getArgumentStringValue } from '../../dataflow/eval/resolve/resolve-argument';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { OtherPathFunctions } from '../../queries/catalog/dependencies-query/function-info/other-path-functions';
import { Identifier } from '../../dataflow/environments/identifier';

export interface AbsoluteFilePathResult extends LintingResult {
	filePath: string,
}

type SupportedWd = '@script' | '@home' | '@project' | string;

export interface AbsoluteFilePathConfig extends MergeableRecord {
	/** Include paths that are built by functions, e.g., `file.path()` */
	include: {
		/** Whether to include paths that are constructed by functions */
		constructed: boolean,
		/** Include every string, even if it is not used as a file path, to count, strings must have a length of at least 3 chars */
		allStrings:  boolean
	},
	/** Extend the built-in absolute path recognition with additional regexes */
	absolutePathRegex:       string | undefined,
	/**
	 * The set of functions that should additionally be considered as using a file path.
	 * Entries in this array use the {@link FunctionInfo} format from the dependencies query.
	 */
	additionalPathFunctions: readonly FunctionInfo[]
	/**
	 * Which path the relative-path quick fix is built against: `@project` (project root, falling back to the
	 * script when there is no root), `@script`, `@home`, or a literal directory.
	 */
	useAsWd:                 SupportedWd
	/** Automatically ignore URLs (http/https/ftp) so they are not reported as absolute paths. */
	ignoreUrls:              boolean
}

export interface AbsoluteFilePathMetadata extends MergeableRecord {
	totalConsidered: number
	totalUnknown:    number
}

function inferWd(file: string | undefined, wd: SupportedWd, ctx: ReadOnlyFlowrAnalyzerContext): string | undefined {
	if(wd === '@script') {
		return file;
	} else if(wd === '@home') {
		return process.env.HOME || process.env.USERPROFILE || '';
	} else if(wd === '@project') {
		return ctx.files.root() ?? file;
	} else {
		return wd;
	}
}

// this can be improved by respecting raw strings and supporting more scenarios
function quickFixForPath(str: RNode | undefined, filePath: string, wd: string | undefined): LintQuickFixReplacement[] | undefined {
	const loc = SourceLocation.fromNode(str);
	if(!wd || !str || !RString.is(str) || loc === undefined) {
		/* a fix that names no place cannot be carried out, so none is offered */
		return undefined;
	}
	return [{
		type:        'replace',
		loc,
		description: `Replace with a relative path to \`${filePath}\``,
		replacement: `${str.content.quotes}${RPath.relative(wd, filePath)}${str.content.quotes}`
	}];
}

/** The paths `file.path(...)` builds, `undefined` if a part is unknown. */
function filePathStrings(graph: DataflowGraph, vtx: DataflowGraphVertexFunctionCall, ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	const variables = ctx.config.solver.variables;
	// in the future we can access `.Platform$file.sep` here
	const fsep = getArgumentStringValue(variables, graph, vtx, undefined, 'fsep', true, ctx);
	const seps = fsep?.values().flatMap(s => s.values().filter(isNotUndefined)).toArray() ?? ['/'];
	if(seps.includes(Unknown)) {
		// if we have no fsep, we cannot construct a path
		return undefined;
	}
	const unnamed = getArgumentStringValue(variables, graph, vtx, 'unnamed', undefined, true, ctx);
	const args = [...unnamed?.values() ?? []].flatMap(v => [...v]);
	if(args.length === 0 || args.some(v => v === Unknown || v === undefined)) {
		// if we have no arguments, we cannot construct a path
		return undefined;
	}
	return seps.map(sep => args.join(sep));
}

/**
 * Resolve a raw string value to the path that should be checked for absoluteness.
 * - `file://` URIs: extract the local path (always checked, ignoreUrls has no effect)
 * - remote URLs (http/s3/...): `undefined` when ignoreUrls is true (skip)
 * - everything else: the value itself
 */
function resolvePathForAbsoluteCheck(value: string, ignoreUrls: boolean): string | undefined {
	const local = fileUrlToPath(value);
	if(local !== undefined) {
		return local;
	}
	return ignoreUrls && isUrl(value) ? undefined : value;
}

/** A path built within a call that already reports it, as `file.path` within `read.csv`, is one finding. */
function withoutNested(results: readonly AbsoluteFilePathResult[]): AbsoluteFilePathResult[] {
	return results.filter((r, i) => !results.some((o, j) => i !== j && o.filePath === r.filePath
		&& (SourceRange.isStrictSubsetOf(r.loc, o.loc) || (j < i && SourceRange.equals(r.loc, o.loc)))));
}

export const ABSOLUTE_PATH = {
	/* this can be done better once we have types */
	createSearch: (config, data) => {
		const ctx = data.inspectContext();
		const pathFunctions = readFunctions(ctx).concat(writeFunctions(ctx), SourceFunctions, OtherPathFunctions, config.additionalPathFunctions);
		let q = config.include.allStrings ? Q.all().filter(RType.String) : Q.fromQuery({
			type:                   'dependencies',
			// we use the dependencies query to give us all functions that take a file path as input
			ignoreDefaultFunctions: true,
			readFunctions:          pathFunctions,
		});
		if(config.include.constructed) {
			q = q.merge(Q.all().filter(VertexType.FunctionCall).with(Enrichment.CallTargets));
		}
		return q.unique();
	},
	processSearchResult: async(elements, config, data): Promise<{ results: AbsoluteFilePathResult[], '.meta': AbsoluteFilePathMetadata }> => {
		const metadata: AbsoluteFilePathMetadata = {
			totalConsidered: 0,
			totalUnknown:    0
		};
		const queryResults = elements.enrichmentContent(Enrichment.QueryData)?.queries;
		const regex = config.absolutePathRegex ? new RegExp(config.absolutePathRegex) : undefined;
		const { idMap } = await data.normalize();
		const { graph } = await data.dataflow();
		const ctx = data.inspectContext();
		const absolute = (value: string): string | undefined => {
			const path = resolvePathForAbsoluteCheck(value, config.ignoreUrls);
			return path !== undefined && isAbsolutePath(path, regex) ? path : undefined;
		};
		const finding = (certainty: LintingResultCertainty, filePath: string, node: RNode | undefined, wd?: string): AbsoluteFilePathResult => compactRecord({
			certainty,
			filePath,
			loc:      SourceLocation.fromNode(node) ?? SourceLocation.invalid(),
			quickFix: quickFixForPath(node, filePath, wd)
		}) as AbsoluteFilePathResult;
		return {
			results: withoutNested(elements.getElements().flatMap(element => {
				metadata.totalConsidered++;
				const node = element.node;
				const wd = inferWd(node.info.file, config.useAsWd, ctx);
				const query = enrichmentContent(element, Enrichment.QueryData);
				if(RString.is(node)) {
					const path = absolute(node.content.str);
					return path !== undefined && path.length >= 3 ? [finding(LintingResultCertainty.Uncertain, path, node, wd)] : [];
				} else if(query) {
					const result = queryResults[query.query] as QueryResults<'dependencies'>['dependencies'];
					const reads = result.read.filter(r => r.nodeId === node.info.id);
					const found = reads.flatMap(r => {
						if(r.value === undefined || r.value === Unknown || r.nodeId === undefined) {
							return [];
						}
						const path = absolute(r.value);
						return path === undefined ? [] : [finding(LintingResultCertainty.Certain, path, idMap.get(r.nodeId), wd)];
					});
					// if we have no absolute paths, but all paths are known, we can return an empty array
					if(found.length > 0 || reads.every(r => r.value !== Unknown)) {
						return found;
					}
				} else {
					const vertex = graph.getVertex(node.info.id);
					if(DfgVertex.isFunctionCall(vertex)) {
						/* `file.path` is the only supported function that returns a file path */
						const strings = Identifier.getName(vertex.name) === 'file.path' ? filePathStrings(graph, vertex, ctx) : [];
						if(strings) {
							return strings.map(absolute).filter(isNotUndefined).map(path => finding(LintingResultCertainty.Uncertain, path, node));
						}
					}
				}
				metadata.totalUnknown++;
				return [];
			})),
			'.meta': metadata
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Path \`${result.filePath}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Path \`${result.filePath}\` at ${SourceLocation.format(result.loc)} is absolute`
	},
	info: {
		name:          'Absolute Paths',
		description:   'Checks whether file paths are absolute.',
		tags:          [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility, LintingRuleTag.Smell, LintingRuleTag.QuickFix],
		// checks all found paths for whether they're absolute to ensure correctness, but doesn't handle non-constant paths so not all will be returned
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: () => ({
			include: {
				constructed: true,
				allStrings:  false
			},
			additionalPathFunctions: [],
			absolutePathRegex:       undefined,
			useAsWd:                 '@project',
			ignoreUrls:              true
		})
	}
} as const satisfies LintingRule<AbsoluteFilePathResult, AbsoluteFilePathMetadata, AbsoluteFilePathConfig>;
