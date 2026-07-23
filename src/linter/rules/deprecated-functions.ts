import type { Range } from 'semver';
import type { BrandedIdentifier } from '../../dataflow/environments/identifier';
import { Identifier } from '../../dataflow/environments/identifier';
import { FunctionArgument } from '../../dataflow/graph/graph';
import { isFunctionCallVertex } from '../../dataflow/graph/vertex';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { isNotUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import { type FunctionsMetadata, functionFinderUtil } from './function-finder-util';
import { RRange } from '../../util/r-version';

/**
 * Information about an argument of a function that should be flagged as deprecated if it is called with this argument
 */
interface DeprecatedArgumentInformation {
	/** Index of the argument */
	readonly argIdx?:       number,
	/** Name of the argument */
	readonly argName?:      string
	/** Only mark this argument as deprecated, if a specific value was provided */
	readonly ifValue?:      RegExp | string
	/** Suggested replacement for this argument */
	readonly replacedBy?:   string
	/** The version since this argument is deprecated */
	readonly sinceVersion?: Range
	/** The state of deprecation {@link DeprecationState}, i.e. is the argument completely removed, or are there better alternatives */
	readonly state?:        DeprecationState
}

/**
 * Information about a deprecated function
 */
interface DeprecatedFunctionInformation {
	/** Mark specific arguments as deprecated */
	readonly whenArgs?:     DeprecatedArgumentInformation[]
	/** Suggested replacement for this function */
	readonly replacedBy?:   string
	/** The version since this function is deprecated */
	readonly sinceVersion?: Range
	/** Lifecycle State {@link DeprecationState}, i.e. is the function completely removed, or are there better alternatives */
	readonly state?:        DeprecationState
}

/**
 * Result of the {@link DEPRECATED_FUNCTIONS} linting rule
 * See also the specializations {@link DeprecatedFunctionResult} and {@link DeprecatedArgumentResult}
 */
export interface DeprecatedFunctionResultBase extends LintingResult {
	/** The function affected by the deprecation */
	readonly function:      Identifier
	/** The suggest replacement for the deprecated argument or function */
	readonly replacedBy?:   string
	/** Since which package version this argument or function is deprecated */
	readonly sinceVersion?: Range
	/** Lifecycle State {@link DeprecationState} */
	readonly state?:        DeprecationState
}

/**
 * Returned by the {@link DEPRECATED_FUNCTIONS} linting rule, when a deprecated function is detected.
 * Provided for convince to differentiate between {@link DeprecatedArgumentResult} and {@link DeprecatedFunctionResult}
 */
export interface DeprecatedFunctionResult extends DeprecatedFunctionResultBase {
	readonly type: 'deprecated-function'
}

/**
 * Returned by the {@link DEPRECATED_FUNCTIONS} linting rule, when a deprecated argument is detected.
 * Provided for convince to differentiate between {@link DeprecatedArgumentResult} and {@link DeprecatedFunctionResult}
 */
export interface DeprecatedArgumentResult extends DeprecatedFunctionResultBase {
	readonly type: 'deprecated-argument'
	/** The name or index of the deprecated argument */
	readonly arg:  string | number
}

export type DeprecatedFunctionRuleResult = DeprecatedFunctionResult | DeprecatedArgumentResult;

export enum DeprecationState {
	/** A better alternative is available, but the function is kept (softer alternative to deprecated) {@link https://lifecycle.r-lib.org/articles/stages.html#superseded} */
	Superseeded = 'superseeded',
	/** A better alternative is available, and the function is marked for removal {@link https://lifecycle.r-lib.org/articles/stages.html#deprecated} */
	Deprecated = 'deprecated',
	/** No longer works and is removed and replaced by another function {@link https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/Defunct} */
	Defunct = 'defunct'
}

export interface DeprecatedFunctionsConfig extends MergeableRecord {
	/** Functions to always mark as deprecated */
	always:        BrandedIdentifier[]
	/** Functions to mark as deprecated for specific argument, argument value or version */
	conditionally: Record<BrandedIdentifier, DeprecatedFunctionInformation>
}

const AlwaysDeprecated = [
	'all_equal', 'arrange_all', 'distinct_all', 'filter_all', 'group_by_all', 'summarise_all', 'mutate_all', 'select_all', 'vars', 'all_vars', 'id', 'failwith', 'select_vars', 'rename_vars', 'select_var', 'current_vars', 'bench_tbls', 'compare_tbls', 'compare_tbls2', 'eval_tbls', 'eval_tbls2', 'location', 'changes', 'combine', 'do', 'funs', 'add_count_', 'add_tally_', 'arrange1_', 'count_', 'distinct_', 'do_', 'filter_', 'funs_', 'group_by_', 'group_indices_', 'mutate_', 'tally_', 'transmute_', 'rename_', 'rename_vars_', 'select_', 'select_vars_', 'slice_', 'summarise_', 'summarize_', 'summarise_each', 'src_local', 'tbl_df', 'add_rownames', 'group_nest', 'group_split', 'with_groups', 'nest_by', 'progress_estimated', 'recode', 'sample_n', 'top_n', 'transmute', 'fct_explicit_na', 'aes_', 'aes_auto', 'annotation_logticks', 'is.Coord', 'coord_flip', 'coord_map', 'is.facet', 'fortify', 'is.ggproto', 'guide_train', 'is.ggplot', 'qplot', 'is.theme', 'gg_dep', 'liply', 'isplit2', 'list_along', 'cross', 'invoke', 'at_depth', 'prepend', 'rerun', 'splice', '`%@%`', 'rbernoulli', 'rdunif', 'when', 'update_list', 'map_raw', 'accumulate', 'reduce_right', 'flatten', 'map_dfr', 'as_vector', 'transpose', 'melt_delim', 'melt_fwf', 'melt_table', 'read_table2', 'str_interp', 'as_tibble', 'data_frame', 'tibble_', 'data_frame_', 'lst_', 'as_data_frame', 'as.tibble', 'frame_data', 'trunc_mat', 'is.tibble', 'tidy_names', 'set_tidy_names', 'repair_names', 'extract_numeric', 'complete_', 'drop_na_', 'expand_', 'crossing_', 'nesting_', 'extract_', 'fill_', 'gather_', 'nest_', 'separate_rows_', 'separate_', 'spread_', 'unite_', 'unnest_', 'extract', 'gather', 'nest_legacy', 'separate_rows', 'separate', 'spread'
];

const ConditionallyDeprecated = {
	'geom_violin': { whenArgs: [{ argName: 'draw_quantiles', state: DeprecationState.Deprecated, replacedBy: 'quantile.linetype', sinceVersion: RRange.parse('>= 4.0.0') }] },
} satisfies Record<BrandedIdentifier, DeprecatedFunctionInformation>;

function getDeprecatedFunctionNames(config: DeprecatedFunctionsConfig): BrandedIdentifier[] {
	return config.always.concat(
		Object.keys(config.conditionally)
	);
}

export const DEPRECATED_FUNCTIONS = {
	createSearch:        (config) => functionFinderUtil.createSearch(getDeprecatedFunctionNames(config)),
	processSearchResult: async(elements, config, data) => {
		const dataflow = (await data.dataflow()).graph;
		const idMap = (await data.normalize()).idMap;

		const metadata: FunctionsMetadata = {
			totalCalls:               0,
			totalFunctionDefinitions: 0
		};

		const detectedFunctions = elements.getElements().flatMap(e => {
			metadata.totalCalls++;
			return enrichmentContent(e, Enrichment.CallTargets).targets.map(target => {
				metadata.totalFunctionDefinitions++;
				const sourceLocation = SourceLocation.fromNode(e.node);
				if(sourceLocation !== undefined) {
					return {
						node: e.node, target: target as BrandedIdentifier, sourceLocation
					};
				}
			});
		}).filter(p => isNotUndefined(p));

		const results = detectedFunctions.map(e => {
			const info = config.conditionally[e.target];
			if(info === undefined) {
				// No extra info => function is always marked as deprecated
				return [{
					type:       'deprecated-function',
					certainty:  LintingResultCertainty.Certain,
					involvedId: e.node.info.id,
					loc:        e.sourceLocation,
					function:   e.target,
				} satisfies DeprecatedFunctionResult];
			} else if(info.whenArgs !== undefined) {
				// If whenArgs is set, the function should only be deprecated if it has one of the provided args
				return info.whenArgs.map(deprecatedArgInfo => {
					const vertex = dataflow.getVertex(e.node.info.id);
					if(vertex === undefined || !isFunctionCallVertex(vertex)) {
						return undefined;
					}

					const arg = vertex.args.find((arg, idx) =>
						FunctionArgument.isNamed(arg) && arg.name === deprecatedArgInfo.argName ||
						FunctionArgument.isPositional(arg) && idx === deprecatedArgInfo.argIdx
					);
					const argNode = arg === undefined || arg === EmptyArgument ? undefined : idMap.get(arg.nodeId);

					if(argNode !== undefined) {
						return {
							type:         'deprecated-argument',
							certainty:    LintingResultCertainty.Certain,
							involvedId:   argNode.info.id,
							function:     e.target,
							arg:          (deprecatedArgInfo.argName ?? deprecatedArgInfo.argIdx) as string | number,
							state:        deprecatedArgInfo.state,
							replacedBy:   deprecatedArgInfo.replacedBy,
							sinceVersion: deprecatedArgInfo.sinceVersion,
							loc:          SourceLocation.fromNode(argNode) ?? e.sourceLocation
						} satisfies DeprecatedArgumentResult;
					}

				// Don't mark function as deprecated, if we didn't find any deprecated args
				}).filter(p => isNotUndefined(p));
			} else {
				// Extra Info but no whenArgs => always marked as deprecated and extra info is provided
				return [{
					type:         'deprecated-function',
					certainty:    LintingResultCertainty.Certain,
					involvedId:   e.node.info.id,
					loc:          e.sourceLocation,
					function:     e.target,
					state:        info.state,
					replacedBy:   info.replacedBy,
					sinceVersion: info.sinceVersion
				} satisfies DeprecatedFunctionResult];
			}
		}).flat();

		return {
			results, '.meta': metadata
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result: DeprecatedFunctionRuleResult) => `${result.type === 'deprecated-argument' ? `Argument \`${result.arg}\` of ` : ''}Function \`${Identifier.toString(result.function)}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  (result: DeprecatedFunctionRuleResult) => {
			const str: string[] = [];
			if(result.type === 'deprecated-argument') {
				const argStr = typeof result.arg === 'number' ? `at position \`${result.arg}\`` : result.arg;
				str.push(`Argument \`${argStr}\` of`);
			}
			str.push(`Function \`${Identifier.toString(result.function)}\` is ${result.state ?? 'deprecated'}`);
			if(result.sinceVersion) {
				str.push(`since version ${result.sinceVersion.format()}`);
			}
			if(result.replacedBy) {
				str.push(`and is replaced by \`${result.replacedBy}\``);
			}
			return str.join(' ');
		}
	},
	info: {
		name:          'Deprecated Functions',
		tags:          [LintingRuleTag.Deprecated, LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		// ensures all deprecated functions found are actually deprecated through its limited config, but doesn't find all deprecated functions since the config is pre-crawled
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks deprecated functions that should not be used anymore.',
		defaultConfig: {
			always:        AlwaysDeprecated,
			conditionally: ConditionallyDeprecated
		}
	}
} as const satisfies LintingRule<DeprecatedFunctionRuleResult, FunctionsMetadata, DeprecatedFunctionsConfig>;
