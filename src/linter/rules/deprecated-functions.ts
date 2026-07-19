import { VertexType } from '../../dataflow/graph/vertex';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { Identifier } from '../../dataflow/environments/identifier';
import { Q } from '../../search/flowr-search-builder';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { testFunctionsIgnoringPackage } from '../../search/flowr-search-filters';
import { SourceLocation } from '../../util/range';
import { LintingRuleCertainty, LintingResultCertainty, type LintingRule } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import { type FunctionsMetadata, type FunctionsResult, type FunctionsToDetectConfig, functionFinderUtil } from './function-finder-util';

export const DEPRECATED_FUNCTIONS = {
	// unlike functionFinderUtil.createSearch(config.fns), this does not pre-filter to the hardcoded list: the
	// sigdb-driven pass below needs every resolved call, so the `fns` filtering happens in processSearchResult instead
	createSearch:        (_config: FunctionsToDetectConfig) => Q.all().filter(VertexType.FunctionCall).with(Enrichment.CallTargets, { onlyBuiltin: true }),
	processSearchResult: async(elements, config, data) => {
		const matchesConfiguredFns = testFunctionsIgnoringPackage(config.fns);
		const hardcoded = await functionFinderUtil.processSearchResult(elements, config, data, es =>
			es.filter(e => enrichmentContent(e, Enrichment.CallTargets)?.targets
				.some(t => typeof t === 'string' && matchesConfiguredFns.test(t))));

		const deps = data.inspectContext().deps;
		if(deps.signatureSources().length === 0) {
			return hardcoded;
		}

		// sigdb-driven detection: flag any resolved call whose signature-database entry marks it deprecated,
		// even when it is not part of the hardcoded `fns` list above
		const graph = (await data.dataflow()).graph;
		const alreadyFlagged = new Set(hardcoded.results.map(r => r.involvedId));
		const sigdbFlagged: FunctionsResult[] = [];
		for(const element of elements.getElements()) {
			const id = element.node.info.id;
			if(alreadyFlagged.has(id)) {
				continue;
			}
			const qualified = Dataflow.qualify(id, graph);
			if(qualified === undefined) {
				continue;
			}
			const fn = deps.signatureOf(qualified);
			if(fn === undefined || !fn.props.includes('deprecated')) {
				continue;
			}
			const loc = SourceLocation.fromNode(element.node);
			if(loc === undefined) {
				continue;
			}
			alreadyFlagged.add(id);
			sigdbFlagged.push({
				certainty:  LintingResultCertainty.Certain,
				involvedId: id,
				function:   Identifier.toString(qualified),
				loc
			});
		}

		return {
			results: [...hardcoded.results, ...sigdbFlagged],
			'.meta': {
				totalCalls:               hardcoded['.meta'].totalCalls + sigdbFlagged.length,
				totalFunctionDefinitions: hardcoded['.meta'].totalFunctionDefinitions + sigdbFlagged.length
			}
		};
	},
	prettyPrint: functionFinderUtil.prettyPrint('deprecated'),
	info:        {
		name:          'Deprecated Functions',
		tags:          [LintingRuleTag.Deprecated, LintingRuleTag.Smell, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		// the hardcoded `fns` list ensures every reported hit is real, but the list is pre-crawled and hence
		// incomplete; the signature-database pass above adds recall for whichever packages are resolved
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks deprecated functions that should not be used anymore.',
		defaultConfig: {
			fns: ['all_equal', 'arrange_all', 'distinct_all', 'filter_all', 'group_by_all', 'summarise_all', 'mutate_all', 'select_all', 'vars', 'all_vars', 'id', 'failwith', 'select_vars', 'rename_vars', 'select_var', 'current_vars', 'bench_tbls', 'compare_tbls', 'compare_tbls2', 'eval_tbls', 'eval_tbls2', 'location', 'changes', 'combine', 'do', 'funs', 'add_count_', 'add_tally_', 'arrange_', 'count_', 'distinct_', 'do_', 'filter_', 'funs_', 'group_by_', 'group_indices_', 'mutate_', 'tally_', 'transmute_', 'rename_', 'rename_vars_', 'select_', 'select_vars_', 'slice_', 'summarise_', 'summarize_', 'summarise_each', 'src_local', 'tbl_df', 'add_rownames', 'group_nest', 'group_split', 'with_groups', 'nest_by', 'progress_estimated', 'recode', 'sample_n', 'top_n', 'transmute', 'fct_explicit_na', 'aes_', 'aes_auto', 'annotation_logticks', 'is.Coord', 'coord_flip', 'coord_map', 'is.facet', 'fortify', 'is.ggproto', 'guide_train', 'is.ggplot', 'qplot', 'is.theme', 'gg_dep', 'liply', 'isplit2', 'list_along', 'cross', 'invoke', 'at_depth', 'prepend', 'rerun', 'splice', '`%@%`', 'rbernoulli', 'rdunif', 'when', 'update_list', 'map_raw', 'accumulate', 'reduce_right', 'flatten', 'map_dfr', 'as_vector', 'transpose', 'melt_delim', 'melt_fwf', 'melt_table', 'read_table2', 'str_interp', 'as_tibble', 'data_frame', 'tibble_', 'data_frame_', 'lst_', 'as_data_frame', 'as.tibble', 'frame_data', 'trunc_mat', 'is.tibble', 'tidy_names', 'set_tidy_names', 'repair_names', 'extract_numeric', 'complete_', 'drop_na_', 'expand_', 'crossing_', 'nesting_', 'extract_', 'fill_', 'gather_', 'nest_', 'separate_rows_', 'separate_', 'spread_', 'unite_', 'unnest_', 'extract', 'gather', 'nest_legacy', 'separate_rows', 'separate', 'spread']
		}
	}
} as const satisfies LintingRule<FunctionsResult, FunctionsMetadata, FunctionsToDetectConfig>;
