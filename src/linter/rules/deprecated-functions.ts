import type { BrandedIdentifier } from '../../dataflow/environments/identifier';
import { FunctionArgument } from '../../dataflow/graph/graph';
import { isFunctionCallVertex } from '../../dataflow/graph/vertex';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { isNotUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import type { LintingResult, LintingRule } from '../linter-format';
import { LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import { type FunctionsMetadata, functionFinderUtil } from './function-finder-util';

/**
 * Information about an argument of a function that should be flagged as deprecated if it is called with this argument
 */
export interface DeprecatedArgumentInformation {
	argIdx?:       number,
	argName?:      string
	ifValue?:      RegExp | string
	replacedBy?:   string
	sinceVersion?: string
	state?:        DeprecationState
}

/**
 * Information about a deprecated function
 */
export interface DeprecatedFunctionInformation {
	name:          string
	/** Used to mark specific arguments as deprecated */
	whenArgs?:     DeprecatedArgumentInformation[]
	replacedBy?:   string
	sinceVersion?: string
	state?:        DeprecationState
}

export interface DeprecatedFunctionResultBase extends LintingResult {
	type:        'deprecated-function' | 'deprecated-arg'
	function:    BrandedIdentifier
	replacedBy?: string
	state?:      DeprecationState
}

export interface DeprecatedFunctionResult extends DeprecatedFunctionResultBase {
	type: 'deprecated-function'
}

export interface DeprecatedArgumentResult extends DeprecatedFunctionResultBase {
	type: 'deprecated-arg'
	arg:  string | number
}

export type DeprecatedFunctionLintingResult = DeprecatedFunctionResult | DeprecatedArgumentResult;


export const enum DeprecationState {
	/**
	 * Still works, but marked for removal
	 */
	Deprecated,
	/**
	 * No longer works, and marked for removal
	 */
	Defunct,
	/**
	 * Replaced by another function but kept for compatibility
	 */
	Superseeded
}

export interface DeprecatedFunctionsConfig extends MergeableRecord{
	/**
	 * Functions to mark as deprecated
	 */
	fns: (string | DeprecatedFunctionInformation)[]
}


const DeprecatedFunctions = [
	{ name: 'geom_violin', whenArgs: [{ argName: 'draw_quantiles', state: DeprecationState.Deprecated, replacedBy: 'quantile.linetype' }] },
	'all_equal', 'arrange_all', 'distinct_all', 'filter_all', 'group_by_all', 'summarise_all', 'mutate_all', 'select_all', 'vars', 'all_vars', 'id', 'failwith', 'select_vars', 'rename_vars', 'select_var', 'current_vars', 'bench_tbls', 'compare_tbls', 'compare_tbls2', 'eval_tbls', 'eval_tbls2', 'location', 'changes', 'combine', 'do', 'funs', 'add_count_', 'add_tally_', 'arrange1_', 'count_', 'distinct_', 'do_', 'filter_', 'funs_', 'group_by_', 'group_indices_', 'mutate_', 'tally_', 'transmute_', 'rename_', 'rename_vars_', 'select_', 'select_vars_', 'slice_', 'summarise_', 'summarize_', 'summarise_each', 'src_local', 'tbl_df', 'add_rownames', 'group_nest', 'group_split', 'with_groups', 'nest_by', 'progress_estimated', 'recode', 'sample_n', 'top_n', 'transmute', 'fct_explicit_na', 'aes_', 'aes_auto', 'annotation_logticks', 'is.Coord', 'coord_flip', 'coord_map', 'is.facet', 'fortify', 'is.ggproto', 'guide_train', 'is.ggplot', 'qplot', 'is.theme', 'gg_dep', 'liply', 'isplit2', 'list_along', 'cross', 'invoke', 'at_depth', 'prepend', 'rerun', 'splice', '`%@%`', 'rbernoulli', 'rdunif', 'when', 'update_list', 'map_raw', 'accumulate', 'reduce_right', 'flatten', 'map_dfr', 'as_vector', 'transpose', 'melt_delim', 'melt_fwf', 'melt_table', 'read_table2', 'str_interp', 'as_tibble', 'data_frame', 'tibble_', 'data_frame_', 'lst_', 'as_data_frame', 'as.tibble', 'frame_data', 'trunc_mat', 'is.tibble', 'tidy_names', 'set_tidy_names', 'repair_names', 'extract_numeric', 'complete_', 'drop_na_', 'expand_', 'crossing_', 'nesting_', 'extract_', 'fill_', 'gather_', 'nest_', 'separate_rows_', 'separate_', 'spread_', 'unite_', 'unnest_', 'extract', 'gather', 'nest_legacy', 'separate_rows', 'separate', 'spread'
] satisfies (string | DeprecatedFunctionInformation)[];

export const DEPRECATED_FUNCTIONS = {
	createSearch:        (config) => functionFinderUtil.createSearch(config.fns.map(fn => typeof fn === 'string' ? fn : fn.name)),
	processSearchResult: async(elements, config, data) => {
		const fnInfosEx = Object.fromEntries(
			config.fns
				.filter(f => typeof f === 'object')
				.map(f => [f.name, f])
		);

		const dataflow = (await data.dataflow()).graph;

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
			const info = fnInfosEx[e.target];
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

					if(arg !== undefined) {
						return {
							type:       'deprecated-arg',
							certainty:  LintingResultCertainty.Certain,
							involvedId: arg === EmptyArgument ? e.node.info.id : arg.nodeId,
							function:   e.target,
							arg:        (deprecatedArgInfo.argName ?? deprecatedArgInfo.argIdx) as string | number,
							state:      deprecatedArgInfo.state,
							replacedBy: deprecatedArgInfo.replacedBy,
							loc:        e.sourceLocation
						} satisfies DeprecatedArgumentResult;
					}

				// Don't mark function as deprecated, if we didn't find any deprecated args
				}).filter(p => p !== undefined);
			} else {
				// Extra Info but no whenArgs => always marked as deprecated and extra info is provided
				return [{
					type:       'deprecated-function',
					certainty:  LintingResultCertainty.Certain,
					involvedId: e.node.info.id,
					loc:        e.sourceLocation,
					function:   e.target,
					state:      info?.state,
					replacedBy: info?.replacedBy
				} satisfies DeprecatedFunctionResult];
			}
		}).flat();

		return {
			results, '.meta': metadata
		};
	},
	prettyPrint: functionFinderUtil.prettyPrint('deprecated'),
	info:        {
		name:          'Deprecated Functions',
		tags:          [LintingRuleTag.Deprecated, LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		// ensures all deprecated functions found are actually deprecated through its limited config, but doesn't find all deprecated functions since the config is pre-crawled
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks deprecated functions that should not be used anymore.',
		defaultConfig: { fns: DeprecatedFunctions }
	}
} as const satisfies LintingRule<DeprecatedFunctionLintingResult, FunctionsMetadata, DeprecatedFunctionsConfig>;
