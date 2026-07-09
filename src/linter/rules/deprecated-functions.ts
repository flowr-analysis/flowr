import type { BrandedIdentifier } from '../../dataflow/environments/identifier';
import { FunctionArgument } from '../../dataflow/graph/graph';
import { isFunctionCallVertex } from '../../dataflow/graph/vertex';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { isNotUndefined } from '../../util/assert';
import { SourceLocation } from '../../util/range';
import { LintingResultCertainty, LintingRuleCertainty, type LintingRule } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import { type FunctionsMetadata, type FunctionsResult, type FunctionsToDetectConfig, functionFinderUtil } from './function-finder-util';

/**
 * Information about an argument of a function that should be flagged as deprected if it is called with this argument
 */
export interface DeprecatedArgumentInformation {
	argIdx?:     number,
	argName?:    string
	ifValue?:    RegExp | string
	replacedBy?: string
	version?:    string
	state:       DeprecationState
}

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

export interface DeprecatedFunctionsConfig<Fns extends readonly string[] = readonly string[]> extends FunctionsToDetectConfig {
	/**
	 * Functions to mark as deprecated
	 */
	fns:      Fns
	/**
	 * Additionally, constraint the detection of an fn in {@link DeprecatedFunctionsConfig.fns} if it is called with an Argument
	 * defined by {@link DeprecatedFunctionsConfig.whenArgs}
	 */
	whenArgs: Partial<Record<Fns[number], DeprecatedArgumentInformation[]>>
}
// Little helper for constraining whenArgs to fns
const defineConfig = <const Fns extends readonly string[]>(config: DeprecatedFunctionsConfig<Fns>) => config;

export const DEPRECATED_FUNCTIONS = {
	createSearch:        (config) => functionFinderUtil.createSearch(config.fns),
	processSearchResult: async(elements, config, data) => {
		const dataflow = (await data.dataflow()).graph;
		const metadata: FunctionsMetadata = {
			totalCalls:               0,
			totalFunctionDefinitions: 0
		};

		const results = elements.getElements().flatMap(e => {
			metadata.totalCalls++;
			return enrichmentContent(e, Enrichment.CallTargets).targets.map(target => {
				metadata.totalFunctionDefinitions++;
				return {
					node:   e.node,
					loc:    SourceLocation.fromNode(e.node),
					target: target as BrandedIdentifier,
				};
			});
		}).filter(e => isNotUndefined(e.loc));

		// Filter out functions that are only deprecated when a certain Argument is present
		const resultsWhenArg = results.flatMap(r => {
			// If not provided in whenArgs, it is always deprecated
			const whenArgs = config.whenArgs[r.target];
			if(whenArgs === undefined) {
				return r;
			}

			// Check if function has deprecated args
			const deprecatedArgs = whenArgs.map(depricationInfo => {
				const vertex = dataflow.getVertex(r.node.info.id);
				if(vertex === undefined || !isFunctionCallVertex(vertex)) {
					return undefined;
				}

				if(vertex.args.some((arg, idx) =>
					FunctionArgument.isNamed(arg) && arg.name === depricationInfo.argName ||
					FunctionArgument.isPositional(arg) && idx === depricationInfo.argIdx
				)) {
					return {
						arg:        depricationInfo.argName ?? depricationInfo.argIdx,
						state:      depricationInfo.state,
						replacedBy: depricationInfo.replacedBy
					};
				}
			}).filter(p => p !== undefined);

			// Don't mark function as deprecated, if we didn't find any deprecated args
			return deprecatedArgs.length === 0 ? undefined : {
				...r,
				deprecatedArgs: deprecatedArgs
			};
		}).filter(p => p !== undefined);

		return {
			results: resultsWhenArg.map(e => ({
				certainty:  LintingResultCertainty.Certain,
				involvedId: e.node.info.id,
				function:   e.target,
				loc:        e.loc
			})) as FunctionsResult[],
			'.meta': metadata
		};
	},
	prettyPrint: functionFinderUtil.prettyPrint('deprecated'),
	info:        {
		name:          'Deprecated Functions',
		tags:          [LintingRuleTag.Deprecated, LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		// ensures all deprecated functions found are actually deprecated through its limited config, but doesn't find all deprecated functions since the config is pre-crawled
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks deprecated functions that should not be used anymore.',
		defaultConfig: defineConfig({
			fns:      ['geom_violin', 'all_equal', 'arrange_all', 'distinct_all', 'filter_all', 'group_by_all', 'summarise_all', 'mutate_all', 'select_all', 'vars', 'all_vars', 'id', 'failwith', 'select_vars', 'rename_vars', 'select_var', 'current_vars', 'bench_tbls', 'compare_tbls', 'compare_tbls2', 'eval_tbls', 'eval_tbls2', 'location', 'changes', 'combine', 'do', 'funs', 'add_count_', 'add_tally_', 'arrange1_', 'count_', 'distinct_', 'do_', 'filter_', 'funs_', 'group_by_', 'group_indices_', 'mutate_', 'tally_', 'transmute_', 'rename_', 'rename_vars_', 'select_', 'select_vars_', 'slice_', 'summarise_', 'summarize_', 'summarise_each', 'src_local', 'tbl_df', 'add_rownames', 'group_nest', 'group_split', 'with_groups', 'nest_by', 'progress_estimated', 'recode', 'sample_n', 'top_n', 'transmute', 'fct_explicit_na', 'aes_', 'aes_auto', 'annotation_logticks', 'is.Coord', 'coord_flip', 'coord_map', 'is.facet', 'fortify', 'is.ggproto', 'guide_train', 'is.ggplot', 'qplot', 'is.theme', 'gg_dep', 'liply', 'isplit2', 'list_along', 'cross', 'invoke', 'at_depth', 'prepend', 'rerun', 'splice', '`%@%`', 'rbernoulli', 'rdunif', 'when', 'update_list', 'map_raw', 'accumulate', 'reduce_right', 'flatten', 'map_dfr', 'as_vector', 'transpose', 'melt_delim', 'melt_fwf', 'melt_table', 'read_table2', 'str_interp', 'as_tibble', 'data_frame', 'tibble_', 'data_frame_', 'lst_', 'as_data_frame', 'as.tibble', 'frame_data', 'trunc_mat', 'is.tibble', 'tidy_names', 'set_tidy_names', 'repair_names', 'extract_numeric', 'complete_', 'drop_na_', 'expand_', 'crossing_', 'nesting_', 'extract_', 'fill_', 'gather_', 'nest_', 'separate_rows_', 'separate_', 'spread_', 'unite_', 'unnest_', 'extract', 'gather', 'nest_legacy', 'separate_rows', 'separate', 'spread'],
			whenArgs: {
				'geom_violin': [{
					argName:    'draw_quantiles',
					state:      DeprecationState.Deprecated,
					replacedBy: 'quantile.linetype'
				}]
			}
		})
	}
} as const satisfies LintingRule<FunctionsResult, FunctionsMetadata, DeprecatedFunctionsConfig>;
