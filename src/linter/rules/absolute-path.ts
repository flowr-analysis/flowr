import type { LintingResult, LintingRule } from '../linter-format';
import { LintingCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import type { SourceRange } from '../../util/range';
import { rangeFrom } from '../../util/range';
import { formatRange } from '../../util/mermaid/dfg';
import { LintingRuleTag } from '../linter-tags';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { isAbsolutePath } from '../../util/text/strings';
import { isRString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { isNotUndefined } from '../../util/assert';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import { WriteFunctions } from '../../queries/catalog/dependencies-query/function-info/write-functions';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import { SourceFunctions } from '../../queries/catalog/dependencies-query/function-info/source-functions';
import { VertexType } from '../../dataflow/graph/vertex';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrSearchElementMaybeFromQuery } from '../../search/flowr-search';
import type { QueryResults } from '../../queries/query';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';

export interface AbsoluteFilePathResult extends LintingResult {
	filePath: string,
	range:    SourceRange
}

export interface AbsoluteFilePathConfig extends MergeableRecord {
	/** Include paths that are built by functions, e.g., `file.path()` */
	include: {
		/** Whether to include paths that are constructed by functions */
		constructed: boolean,
		/** Include every string, even if it is not used as a file path */
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
	 * `@cwd` is the current working directory.
	 */
	useAsWd:                 '@script' | '@project' | '@file' | '@cwd' | '@home' | string
	// TODO: wd and constructed paths
	// TODO: quickfix
}

export interface AbsoluteFilePathMetadata extends MergeableRecord {
	totalConsidered: number
	totalUnknown:    number
}


export const ABSOLUTE_PATH = {
	/* this can be done better once we have types */
	createSearch: (config) => {
		if(config.include.allStrings) {
			return Q.all().filter(RType.String);
		}
		let q = Q.fromQuery({
			type:                   'dependencies',
			// we use the dependencies query to give us all functions that take a file path as input
			ignoreDefaultFunctions: true,
			readFunctions:          ReadFunctions.concat(WriteFunctions, SourceFunctions, config.additionalPathFunctions),
		});
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
		const regex = config.absolutePathRegex ? new RegExp(config.absolutePathRegex) : undefined;
		return {
			results: elements.getElements().flatMap(element => {
				metadata.totalConsidered++;
				const node = element.node;
				if(isRString(node)) {
					if(isAbsolutePath(node.content.str, regex)) {
						return [{
							certainty: LintingCertainty.Maybe,
							filePath:  node.content.str,
							range:     node.info.fullRange ?? node.location
						}];
					} else {
						return [];
					}
				} else if(element.queryResult) {
					const result = element.queryResult as QueryResults<'dependencies'>['dependencies'];
					const mappedStrings = result.readData.filter(r => r.source !== Unknown && isAbsolutePath(r.source, regex)).map(r => {
						const elem = data.normalize.idMap.get(r.nodeId);
						return {
							certainty: LintingCertainty.Definitely,
							filePath:  r.source,
							range:     elem?.info.fullRange ?? elem?.location ?? rangeFrom(-1, -1, -1, -1)
						};
					});
					if(mappedStrings.length > 0) {
						return mappedStrings;
					} else if(result.readData.every(r => r.source !== Unknown)) {
						// if we have no absolute paths, but all paths are known, we can return an empty array
						return [];
					}
				}

				metadata.totalUnknown++;
				// TODO: check for paths
				return undefined;
			}).filter(isNotUndefined),
			'.meta': metadata
		};
	},
	prettyPrint: result => `Path \`${result.filePath}\` at ${formatRange(result.range)}`,
	info:        {
		description:   'Checks whether file paths are absolute',
		tags:          [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility, LintingRuleTag.Smell],
		defaultConfig: {
			include: {
				constructed: true,
				allStrings:  false
			},
			additionalPathFunctions: [],
			absolutePathRegex:       undefined,
			useAsWd:                 '@cwd'
		}
	}
} as const satisfies LintingRule<AbsoluteFilePathResult, AbsoluteFilePathMetadata, AbsoluteFilePathConfig, ParentInformation, FlowrSearchElementMaybeFromQuery<ParentInformation>[]>;

