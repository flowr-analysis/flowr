import type { LintingResult, LintingRule } from '../linter-format';
import { LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import { Q } from '../../search/flowr-search-builder';
import type { MergeableRecord } from '../../util/objects';
import { formatRange } from '../../util/mermaid/dfg';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { SourceRange } from '../../util/range';
import type { Identifier } from '../../dataflow/environments/identifier';
import { FlowrFilter, testFunctionsIgnoringPackage } from '../../search/flowr-search-filters';
import { LintingRuleTag } from '../linter-tags';

export interface DeprecatedFunctionsResult extends LintingResult {
	function: string
	range:    SourceRange
}

export interface DeprecatedFunctionsConfig extends MergeableRecord {
	/**
	 * The list of function names that should be marked as deprecated.
	 */
	deprecatedFunctions: string[]
}

export interface DeprecatedFunctionsMetadata extends MergeableRecord {
	totalDeprecatedCalls:               number;
	totalDeprecatedFunctionDefinitions: number;
}

export const DEPRECATED_FUNCTIONS = {
	createSearch: (config) => Q.all()
		.with(Enrichment.CallTargets, { onlyBuiltin: true })
		.filter({
			name: FlowrFilter.MatchesEnrichment,
			args: {
				enrichment: Enrichment.CallTargets,
				test:       testFunctionsIgnoringPackage(config.deprecatedFunctions)
			}
		}),
	processSearchResult: (elements) => {
		const metadata: DeprecatedFunctionsMetadata = {
			totalDeprecatedCalls:               0,
			totalDeprecatedFunctionDefinitions: 0
		};
		return {
			results: elements.getElements()
				.flatMap(element => {
					metadata.totalDeprecatedCalls++;
					return enrichmentContent(element, Enrichment.CallTargets).targets.map(target => {
						metadata.totalDeprecatedFunctionDefinitions++;
						return {
							range:  element.node.info.fullRange as SourceRange,
							target: target as Identifier
						};
					});
				})
				.map(element => ({
					certainty: LintingResultCertainty.Certain,
					function:  element.target,
					range:     element.range
				})),
			'.meta': metadata
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Function \`${result.function}\` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  result => `Function \`${result.function}\` called at ${formatRange(result.range)} is deprecated`
	},
	info: {
		name:          'Deprecated Functions',
		tags:          [LintingRuleTag.Deprecated, LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		// ensures all deprecated functions found are actually deprecated through its limited config, but doesn't find all deprecated functions since the config is pre-crawled
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks deprecated functions that should not be used anymore.',
		defaultConfig: {
			deprecatedFunctions: ['all_equal', 'arrange_all', 'distinct_all', 'filter_all', 'group_by_all', 'summarise_all', 'mutate_all', 'select_all', 'vars', 'all_vars', 'id', 'failwith', 'select_vars', 'rename_vars', 'select_var', 'current_vars', 'bench_tbls', 'compare_tbls', 'compare_tbls2', 'eval_tbls', 'eval_tbls2', 'location', 'changes', 'combine', 'do', 'funs', 'add_count_', 'add_tally_', 'arrange_', 'count_', 'distinct_', 'do_', 'filter_', 'funs_', 'group_by_', 'group_indices_', 'mutate_', 'tally_', 'transmute_', 'rename_', 'rename_vars_', 'select_', 'select_vars_', 'slice_', 'summarise_', 'summarize_', 'summarise_each', 'src_local', 'tbl_df', 'add_rownames', 'group_nest', 'group_split', 'with_groups', 'nest_by', 'progress_estimated', 'recode', 'sample_n', 'top_n', 'transmute', 'fct_explicit_na', 'aes_', 'aes_auto', 'annotation_logticks', 'is.Coord', 'coord_flip', 'coord_map', 'is.facet', 'fortify', 'is.ggproto', 'guide_train', 'is.ggplot', 'qplot', 'is.theme', 'gg_dep', 'liply', 'isplit2', 'list_along', 'cross', 'invoke', 'at_depth', 'prepend', 'rerun', 'splice', '`%@%`', 'rbernoulli', 'rdunif', 'when', 'update_list', 'map_raw', 'accumulate', 'reduce_right', 'flatten', 'map_dfr', 'as_vector', 'transpose', 'melt_delim', 'melt_fwf', 'melt_table', 'read_table2', 'str_interp', 'as_tibble', 'data_frame', 'tibble_', 'data_frame_', 'lst_', 'as_data_frame', 'as.tibble', 'frame_data', 'trunc_mat', 'is.tibble', 'tidy_names', 'set_tidy_names', 'repair_names', 'extract_numeric', 'complete_', 'drop_na_', 'expand_', 'crossing_', 'nesting_', 'extract_', 'fill_', 'gather_', 'nest_', 'separate_rows_', 'separate_', 'spread_', 'unite_', 'unnest_', 'extract', 'gather', 'nest_legacy', 'separate_rows', 'separate', 'spread',]
		}
	}
} as const satisfies LintingRule<DeprecatedFunctionsResult, DeprecatedFunctionsMetadata, DeprecatedFunctionsConfig>;
