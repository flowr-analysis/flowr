import type { LintingResult, LintingRule, LintQuickFixReplacement } from '../linter-format';
import { LintingPrettyPrintContext , LintingCertainty } from '../linter-format';

import type { MergeableRecord } from '../../util/objects';
import { compactRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import type { SourceRange } from '../../util/range';
import { rangeFrom } from '../../util/range';
import { formatRange } from '../../util/mermaid/dfg';
import { LintingRuleTag } from '../linter-tags';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { isAbsolutePath } from '../../util/text/strings';
import { isRString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import { WriteFunctions } from '../../queries/catalog/dependencies-query/function-info/write-functions';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { SourceFunctions } from '../../queries/catalog/dependencies-query/function-info/source-functions';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { isFunctionCallVertex, VertexType } from '../../dataflow/graph/vertex';
import type { QueryResults } from '../../queries/query';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { getArgumentStringValue } from '../../dataflow/eval/resolve/resolve-argument';
import path from 'path';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { FlowrConfigOptions } from '../../config';

export interface AbsoluteFilePathResult extends LintingResult {
	filePath: string,
	range:    SourceRange
}

type SupportedWd = '@script' | '@home' | string;

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
	additionalPathFunctions: FunctionInfo[]
	/**
	 * Which path should be considered to be the origin for relative paths.
	 * This is only relevant with quickfixes. In the future we may be sensitive to setwd etc.
	 */
	useAsWd:                 SupportedWd
}

export interface AbsoluteFilePathMetadata extends MergeableRecord {
	totalConsidered: number
	totalUnknown:    number
}

function inferWd(file: string | undefined, wd: SupportedWd): string | undefined {
	if(wd === '@script') {
		// we can use the script path as the working directory
		return file;
	} else if(wd === '@home') {
		// we can use the home directory as the working directory
		return process.env.HOME || process.env.USERPROFILE || '';
	} else {
		return wd;
	}
}

// this can be improved by respecting raw strings and supporting more scenarios
function buildQuickFix(str: RNode | undefined, filePath: string, wd: string | undefined): LintQuickFixReplacement[] | undefined {
	if(!wd || !isRString(str)) {
		return undefined;
	}
	return [{
		type:        'replace',
		range:       str.location,
		description: `Replace with a relative path to \`${filePath}\``,
		replacement: str.content.quotes + '.' + path.sep + path.relative(wd, filePath) + str.content.quotes
	}];
}

/** return all strings constructable by these functions */
const PathFunctions: Record<string, (df: DataflowGraph, vtx: DataflowGraphVertexFunctionCall, config: FlowrConfigOptions) => string[] | undefined> = {
	'file.path': (df: DataflowGraph, vtx: DataflowGraphVertexFunctionCall, config: FlowrConfigOptions): string[] | undefined => {
		const fsep = getArgumentStringValue(config.solver.variables,
			df, vtx, undefined, 'fsep', true
		);
		// in the future we can access `.Platform$file.sep` here
		const sepValues: string[] = new Array(...fsep?.values()?.flatMap(s => [...s].filter(isNotUndefined)) ?? [path.sep]);
		if(sepValues.some(s => s === Unknown || isUndefined(s))) {
			// if we have no fsep, we cannot construct a path
			return undefined;
		}
		const args = getArgumentStringValue(config.solver.variables, df, vtx, 'unnamed', undefined, true);
		const argValues = args ? Array.from(args.values()).flatMap(v => [...v]) : [];
		if(!argValues || argValues.length === 0 || argValues.some(v => v === Unknown || isUndefined(v))) {
			// if we have no arguments, we cannot construct a path
			return undefined;
		}
		const results: string[] = [];
		for(const val of sepValues) {
			results.push(argValues.join(val));
		}
		return results;
	}
};

export const ABSOLUTE_PATH = {
	/* this can be done better once we have types */
	createSearch: (config) => {
		let q;
		if(config.include.allStrings) {
			q = Q.all().filter(RType.String);
		} else {
			q = Q.fromQuery({
				type:                   'dependencies',
				// we use the dependencies query to give us all functions that take a file path as input
				ignoreDefaultFunctions: true,
				readFunctions:          ReadFunctions.concat(WriteFunctions, SourceFunctions, config.additionalPathFunctions),
			});
		}
		if(config.include.constructed) {
			q = q.merge(Q.all().filter(VertexType.FunctionCall).with(Enrichment.CallTargets));
			/* in the future we want to directly check whether this is one of the supported functions */
		}
		return q.unique();
	},
	processSearchResult: (elements, config, data): { results: AbsoluteFilePathResult[], '.meta': AbsoluteFilePathMetadata } => {
		const metadata: AbsoluteFilePathMetadata = {
			totalConsidered: 0,
			totalUnknown:    0
		};
		const queryResults = elements.enrichmentContent(Enrichment.QueryData)?.queries;
		const regex = config.absolutePathRegex ? new RegExp(config.absolutePathRegex) : undefined;
		return {
			results: elements.getElements().flatMap(element => {
				metadata.totalConsidered++;
				const node = element.node;
				const wd = inferWd(node.info.file, config.useAsWd);
				if(isRString(node)) {
					if(node.content.str.length >= 3 && isAbsolutePath(node.content.str, regex)) {
						return [{
							certainty: LintingCertainty.Uncertain,
							filePath:  node.content.str,
							range:     node.info.fullRange ?? node.location,
							quickFix:  buildQuickFix(node, node.content.str, wd)
						}];
					} else {
						return [];
					}
				} else if(enrichmentContent(element, Enrichment.QueryData)) {
					const result = queryResults[enrichmentContent(element, Enrichment.QueryData).query] as QueryResults<'dependencies'>['dependencies'];
					const mappedStrings = result.readData.filter(r => r.source !== Unknown && isAbsolutePath(r.source, regex)).map(r => {
						const elem = data.normalize.idMap.get(r.nodeId);
						return {
							certainty: LintingCertainty.Certain,
							filePath:  r.source,
							range:     elem?.info.fullRange ?? elem?.location ?? rangeFrom(-1, -1, -1, -1),
							quickFix:  buildQuickFix(elem, r.source, wd)
						};
					});
					if(mappedStrings.length > 0) {
						return mappedStrings;
					} else if(result.readData.every(r => r.source !== Unknown)) {
						// if we have no absolute paths, but all paths are known, we can return an empty array
						return [];
					}
				} else {
					const dfNode = data.dataflow.graph.getVertex(node.info.id);
					if(isFunctionCallVertex(dfNode)) {
						const handler = PathFunctions[dfNode.name ?? ''];
						const strings = handler ? handler(data.dataflow.graph, dfNode, data.config) : [];
						if(strings) {
							return strings.filter(s => isAbsolutePath(s, regex)).map(str => ({
								certainty: LintingCertainty.Uncertain,
								filePath:  str,
								range:     node.info.fullRange ?? node.location ?? rangeFrom(-1, -1, -1, -1)
							}));
						}
					}
					// check whether the df node is a function call that returns a file path
				}

				metadata.totalUnknown++;
				return undefined;
			}).filter(isNotUndefined).map(r => compactRecord(r) as AbsoluteFilePathResult),
			'.meta': metadata
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Path \`${result.filePath}\` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  result => `Path \`${result.filePath}\` at ${formatRange(result.range)} is not absolute`
	},
	info: {
		name:          'Absolute Paths',
		description:   'Checks whether file paths are absolute.',
		tags:          [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility, LintingRuleTag.Smell, LintingRuleTag.QuickFix],
		defaultConfig: {
			include: {
				constructed: true,
				allStrings:  false
			},
			additionalPathFunctions: [],
			absolutePathRegex:       undefined,
			useAsWd:                 '@script'
		}
	}
} as const satisfies LintingRule<AbsoluteFilePathResult, AbsoluteFilePathMetadata, AbsoluteFilePathConfig>;
