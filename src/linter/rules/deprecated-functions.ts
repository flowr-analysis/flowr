import type { LintingResult, LintingRule } from '../linter-format';
import { LintingCertainty } from '../linter-format';
import { Q } from '../../search/flowr-search-builder';
import type { MergeableRecord } from '../../util/objects';
import { formatRange } from '../../util/mermaid/dfg';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { SourceRange } from '../../util/range';
import type { Identifier } from '../../dataflow/environments/identifier';
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
	totalRelevant:      number
	totalNotDeprecated: number
}

export const DEPRECATED_FUNCTIONS = {
	createSearch:        (_config) => Q.all().with(Enrichment.CallTargets),
	processSearchResult: (elements, config) => {
		const metadata: DeprecatedFunctionsMetadata = {
			totalRelevant:      0,
			totalNotDeprecated: 0
		};
		return {
			results: elements.getElements()
				.flatMap(element => {
					const targets = enrichmentContent(element, Enrichment.CallTargets).targets;
					// if there is a call target that is not built-in (ie a custom function), we don't want to mark it as deprecated
					// eventually we'd want to solve this with an argument to the CallTargets enrichment like satisfiesCallTargets does!
					if(targets.some(t => typeof t !== 'string')) {
						return [];
					}
					return targets.map(target => {
						metadata.totalRelevant++;
						return {
							range:  element.node.info.fullRange as SourceRange,
							target: target as Identifier
						};
					});
				})
				.filter(element => {
					if(config.deprecatedFunctions.includes(element.target)) {
						return true;
					} else {
						metadata.totalNotDeprecated++;
						return false;
					}
				})
				.map(element => ({
					certainty: LintingCertainty.Definitely,
					function:  element.target,
					range:     element.range
				})),
			'.meta': metadata
		};
	},
	prettyPrint: result => `Function \`${result.function}\` at ${formatRange(result.range)}`,
	info:        {
		tags:          [LintingRuleTag.Deprecated, LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		description:   'Marks deprecated functions that should not be used anymore.',
		defaultConfig: {
			deprecatedFunctions: ['all_equal', 'arrange_all', 'distinct_all', 'filter_all', 'group_by_all', 'summarise_all', 'mutate_all', 'select_all', 'vars', 'all_vars', 'id', 'failwith', 'select_vars', 'rename_vars', 'select_var', 'current_vars', 'bench_tbls', 'compare_tbls', 'compare_tbls2', 'eval_tbls', 'eval_tbls2', 'location', 'changes', 'combine', 'do', 'funs', 'add_count_', 'add_tally_', 'arrange_', 'count_', 'distinct_', 'do_', 'filter_', 'funs_', 'group_by_', 'group_indices_', 'mutate_', 'tally_', 'transmute_', 'rename_', 'rename_vars_', 'select_', 'select_vars_', 'slice_', 'summarise_', 'summarize_', 'summarise_each', 'src_local', 'tbl_df', 'add_rownames', 'group_nest', 'group_split', 'with_groups', 'nest_by', 'progress_estimated', 'recode', 'sample_n', 'top_n', 'transmute', 'fct_explicit_na', 'aes_', 'aes_auto', 'annotation_logticks', 'is.Coord', 'coord_flip', 'coord_map', 'is.facet', 'fortify', 'is.ggproto', 'guide_train', 'is.ggplot', 'qplot', 'is.theme', 'gg_dep', 'liply', 'isplit2', 'list_along', 'cross', 'invoke', 'at_depth', 'prepend', 'rerun', 'splice', '`%@%`', 'rbernoulli', 'rdunif', 'when', 'update_list', 'map_raw', 'accumulate', 'reduce_right', 'flatten', 'map_dfr', 'as_vector', 'transpose', 'melt_delim', 'melt_fwf', 'melt_table', 'read_table2', 'str_interp', 'as_tibble', 'data_frame', 'tibble_', 'data_frame_', 'lst_', 'as_data_frame', 'as.tibble', 'frame_data', 'trunc_mat', 'is.tibble', 'tidy_names', 'set_tidy_names', 'repair_names', 'extract_numeric', 'complete_', 'drop_na_', 'expand_', 'crossing_', 'nesting_', 'extract_', 'fill_', 'gather_', 'nest_', 'separate_rows_', 'separate_', 'spread_', 'unite_', 'unnest_', 'extract', 'gather', 'nest_legacy', 'separate_rows', 'separate', 'spread',]
		}
	}
} as const satisfies LintingRule<DeprecatedFunctionsResult, DeprecatedFunctionsMetadata, DeprecatedFunctionsConfig>;
