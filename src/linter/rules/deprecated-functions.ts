import type { Range } from 'semver';
import type { BrandedIdentifier } from '../../dataflow/environments/identifier';
import { Identifier } from '../../dataflow/environments/identifier';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { FunctionArgument } from '../../dataflow/graph/graph';
import { isFunctionCallVertex, VertexType } from '../../dataflow/graph/vertex';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { isNotUndefined } from '../../util/assert';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext, LintingResultCertainty, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';
import { RRange } from '../../util/r-version';
import { Q } from '../../search/flowr-search-builder';
import { testFunctionsIgnoringPackage } from '../../search/flowr-search-filters';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Dataflow } from '../../dataflow/graph/df-helper';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';

/**
 * Information about an argument of a function that should be flagged as deprecated if it is called with this argument
 *
 * Used in {@link DeprecatedFunctionInformation} to mark a function argument as deprecate under certain conditions
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
 *
 * Used in {@link DeprecatedFunctionsConfig.conditionally} to mark a function as deprecate under certain conditions
 */
interface DeprecatedFunctionInformation {
	/**
	 * Mark specific arguments as deprecated
	 * If only whenArgs is provided, and not sinceVersion, the function is only marked as deprecated, if the argument is provided.
	 */
	readonly whenArgs?:     DeprecatedArgumentInformation[]
	/** Suggested replacement for this function */
	readonly replacedBy?:   string
	/** The version since this function is deprecated, if version is provided the entire function will be marked as deprecated, if the version range matches */
	readonly sinceVersion?: Range
	/** Lifecycle State {@link DeprecationState}, i.e. is the function completely removed, or are there better alternatives */
	readonly state?:        DeprecationState
	/** The package this function comes from */
	readonly package:       string
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

interface PotentialFunction {
	node:           RNode<ParentInformation>;
	target:         BrandedIdentifier;
	sourceLocation: SourceLocation
}

interface Metadata extends MergeableRecord {
	sigdb:     number,
	hardcoded: number
}

const AlwaysDeprecated = [
	'all_equal', 'arrange_all', 'distinct_all', 'filter_all', 'group_by_all', 'summarise_all', 'mutate_all', 'select_all', 'vars', 'all_vars', 'id', 'failwith', 'select_vars', 'rename_vars', 'select_var', 'current_vars', 'bench_tbls', 'compare_tbls', 'compare_tbls2', 'eval_tbls', 'eval_tbls2', 'location', 'changes', 'combine', 'do', 'funs', 'add_count_', 'add_tally_', 'arrange1_', 'count_', 'distinct_', 'do_', 'filter_', 'funs_', 'group_by_', 'group_indices_', 'mutate_', 'tally_', 'transmute_', 'rename_', 'rename_vars_', 'select_', 'select_vars_', 'slice_', 'summarise_', 'summarize_', 'summarise_each', 'src_local', 'tbl_df', 'add_rownames', 'group_nest', 'group_split', 'with_groups', 'nest_by', 'progress_estimated', 'recode', 'sample_n', 'top_n', 'transmute', 'fct_explicit_na', 'aes_', 'aes_auto', 'annotation_logticks', 'is.Coord', 'coord_flip', 'coord_map', 'is.facet', 'fortify', 'is.ggproto', 'guide_train', 'is.ggplot', 'qplot', 'is.theme', 'gg_dep', 'liply', 'isplit2', 'list_along', 'cross', 'invoke', 'at_depth', 'prepend', 'rerun', 'splice', '`%@%`', 'rbernoulli', 'rdunif', 'when', 'update_list', 'map_raw', 'accumulate', 'reduce_right', 'flatten', 'map_dfr', 'as_vector', 'transpose', 'melt_delim', 'melt_fwf', 'melt_table', 'read_table2', 'str_interp', 'as_tibble', 'data_frame', 'tibble_', 'data_frame_', 'lst_', 'as_data_frame', 'as.tibble', 'frame_data', 'trunc_mat', 'is.tibble', 'tidy_names', 'set_tidy_names', 'repair_names', 'extract_numeric', 'complete_', 'drop_na_', 'expand_', 'crossing_', 'nesting_', 'extract_', 'fill_', 'gather_', 'nest_', 'separate_rows_', 'separate_', 'spread_', 'unite_', 'unnest_', 'extract', 'gather', 'nest_legacy', 'separate_rows', 'separate', 'spread'
];

const ConditionallyDeprecated = {
	'geom_violin': { package: 'ggplot2', whenArgs: [{ argName: 'draw_quantiles', state: DeprecationState.Deprecated, replacedBy: 'quantile.linetype', sinceVersion: RRange.parse('>= 4.0.0') }] },
} satisfies Record<BrandedIdentifier, DeprecatedFunctionInformation>;

export const DEPRECATED_FUNCTIONS = {
	// unlike functionFinderUtil.createSearch(config.fns), this does not pre-filter to the hardcoded list: the
	// sigdb-driven pass below needs every resolved call, so the `fns` filtering happens in processSearchResult instead
	createSearch:        (_config) => Q.all().filter(VertexType.FunctionCall).with(Enrichment.CallTargets, { onlyBuiltin: true }),
	processSearchResult: async(elements, config, data) => {
		const matchesConfiguredFns = testFunctionsIgnoringPackage(config.always);
		const graph = (await data.dataflow()).graph;
		const idMap = (await data.normalize()).idMap;

		// 1. Collect all function call targets from detected function calls
		const detectedFunctions = elements.getElements().flatMap(e => {
			return enrichmentContent(e, Enrichment.CallTargets).targets.map(target => {
				const sourceLocation = SourceLocation.fromNode(e.node);
				if(sourceLocation !== undefined) {
					return {
						node: e.node, target: target as BrandedIdentifier, sourceLocation
					};
				}
			});
		}).filter(p => isNotUndefined(p));

		// 2. Uses hardcoded information about deprecated arguments and deprecated functions
		const results: DeprecatedFunctionRuleResult[] = detectedFunctions.map(candidate => {
			const info = config.conditionally[candidate.target];
			if(isNotUndefined(info)) {
				// Check functions from DeprecatedFunctionsConfig.conditionally
				return deprecateFunctionConditionally(candidate, graph, idMap, data.inspectContext(), info);
			} else {
				// Check functions from DeprecatedFunctionsConfig.always
				return deprecateFunctionAlways(candidate, matchesConfiguredFns);
			}
		}).filter(p => isNotUndefined(p)).flat();


		// 3. If available, use sigdb to flag deprecated functions
		const deps = data.inspectContext().deps;
		if(deps.signatureSources().length === 0) {
			return { results, '.meta': { hardcoded: results.length, sigdb: 0 } };
		}

		// sigdb-driven detection: flag any resolved call whose signature-database entry marks it deprecated,
		// even when it is not part of the hardcoded `fns` list above
		const alreadyFlagged = new Set(results.map(r => r.involvedId));
		const sigdbFlagged: DeprecatedFunctionResult[] = [];
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
				type:       'deprecated-function',
				certainty:  LintingResultCertainty.Certain,
				involvedId: id,
				function:   Identifier.toString(qualified),
				loc
			});
		}

		return {
			results: results.concat(sigdbFlagged),
			'.meta': { hardcoded: results.length, sigdb: sigdbFlagged.length }
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
		// the hardcoded `always` and `conditionally` list ensures every reported hit is real, but the list is pre-crawled and hence
		// incomplete; the signature-database pass above adds recall for whichever packages are resolved
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks deprecated functions that should not be used anymore.',
		defaultConfig: {
			always:        AlwaysDeprecated,
			conditionally: ConditionallyDeprecated
		}
	}
} as const satisfies LintingRule<DeprecatedFunctionRuleResult, Metadata, DeprecatedFunctionsConfig>;

/**
 * This function is applied to function candidates that have an entry in the {@link DeprecatedFunctionsConfig.conditionally} map.
 */
function deprecateFunctionConditionally(candidate: PotentialFunction, dataflow: DataflowGraph, idMap: AstIdMap, context: ReadOnlyFlowrAnalyzerContext, info: DeprecatedFunctionInformation): DeprecatedFunctionRuleResult[] {
	const results: DeprecatedFunctionRuleResult[] = [];

	// If when args is provided, mark the function as deprecated (and its argument) if the respective argument is present
	if(info.whenArgs) {
		for(const deprecatedArgInfo of info.whenArgs) {
			const vertex = dataflow.getVertex(candidate.node.info.id);
			if(vertex === undefined || !isFunctionCallVertex(vertex)) {
				continue;
			}

			// Check if function call has deprecated argument
			const arg = vertex.args.find((arg, idx) =>
				FunctionArgument.isNamed(arg) && arg.name === deprecatedArgInfo.argName ||
				FunctionArgument.isPositional(arg) && idx === deprecatedArgInfo.argIdx
			);
			const argNode = arg === undefined || arg === EmptyArgument ? undefined : idMap.get(arg.nodeId);
			if(argNode === undefined) {
				continue;
			}

			// Check if the argument is deprecated in the used package version (if set)
			let certainty = LintingResultCertainty.Certain;
			if(deprecatedArgInfo.sinceVersion) {
				const derivedVersion = context.deps.getDependency(info.package)?.derivedVersion;
				if(derivedVersion === undefined) {
					// If the version can't be resolved, mark as uncertain
					certainty = LintingResultCertainty.Uncertain;
				} else {
					// Don't mark as deprecated if the version constraint is not satisfied
					if(!deprecatedArgInfo.sinceVersion.intersects(derivedVersion)) {
						continue;
					}
				}
			}

			// TODO: ifValue check

			results.push({
				type:         'deprecated-argument',
				certainty:    certainty,
				involvedId:   argNode.info.id,
				function:     candidate.target,
				arg:          (deprecatedArgInfo.argName ?? deprecatedArgInfo.argIdx) as string | number,
				state:        deprecatedArgInfo.state,
				replacedBy:   deprecatedArgInfo.replacedBy,
				sinceVersion: deprecatedArgInfo.sinceVersion,
				loc:          SourceLocation.fromNode(argNode) ?? candidate.sourceLocation
			} satisfies DeprecatedArgumentResult);
		}
	}

	// Otherwise, check version and deprecate entire function in case of version range match
	if(info.sinceVersion) {
		// TODO: Version Check
		results.push({
			type:         'deprecated-function',
			certainty:    LintingResultCertainty.Certain,
			involvedId:   candidate.node.info.id,
			loc:          candidate.sourceLocation,
			function:     candidate.target,
			state:        info.state,
			replacedBy:   info.replacedBy,
			sinceVersion: info.sinceVersion
		} satisfies DeprecatedFunctionResult);
	}

	return results;
}


/**
 * This function is applied to function candidates that have an entry in the {@link DeprecatedFunctionsConfig.always} map.
 */
function deprecateFunctionAlways(candidate: PotentialFunction, matchesConfiguredFns: RegExp): DeprecatedFunctionResult | undefined {
	if(!matchesConfiguredFns.test(candidate.target)) {
		return undefined;
	}

	return {
		type:       'deprecated-function',
		certainty:  LintingResultCertainty.Certain,
		involvedId: candidate.node.info.id,
		loc:        candidate.sourceLocation,
		function:   candidate.target,
	} satisfies DeprecatedFunctionResult;
}
