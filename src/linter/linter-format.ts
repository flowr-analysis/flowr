import type { FlowrSearchLike } from '../search/flowr-search-builder';
import type { FlowrSearchElement, FlowrSearchElements } from '../search/flowr-search';
import type { MergeableRecord } from '../util/objects';
import type { GeneratorNames } from '../search/search-executor/search-generators';
import type { TransformerNames } from '../search/search-executor/search-transformer';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { LintingRuleConfig, LintingRuleMetadata, LintingRuleNames, LintingRuleResult } from './linter-rules';
import type { DataflowInformation } from '../dataflow/info';
import type { FlowrConfigOptions } from '../config';
import type { DeepPartial, DeepReadonly } from 'ts-essentials';
import type { LintingRuleTag } from './linter-tags';
import type { SourceRange } from '../util/range';

export interface LinterRuleInformation<Config extends MergeableRecord = never> {
	/** Human-Readable name of the linting rule. */
	readonly name:          string;
	/**
	 * The default config for this linting rule.
	 * This config is combined with the user config when executing the rule.
	 */
	readonly defaultConfig: NoInfer<DeepReadonly<Config>>;
	/**
	 * A short list of tags that describe and categorize the linting rule.
	 */
	readonly tags:          readonly LintingRuleTag[];
	/**
	 * The linting rule's certainty in terms of the rule's calculations' precision and recall.
	 */
	readonly certainty:     LintingRuleCertainty;
	/**
	 * A short description of the linting rule.
	 * This is used to display the rule in the UI and to provide a brief overview of what the rule does.
	 */
	readonly description:   string;
}

/**
 * The base interface for a linting rule, which contains all of its relevant settings.
 * The registry of valid linting rules is stored in {@link LintingRules}.
 */
export interface LintingRule<Result extends LintingResult, Metadata extends MergeableRecord, Config extends MergeableRecord = never, Info = ParentInformation, Elements extends FlowrSearchElement<Info>[] = FlowrSearchElement<Info>[]> {
	/**
	 * Creates a flowR search that will then be executed and whose results will be passed to {@link processSearchResult}.
	 * In the future, additional optimizations and transformations may be applied to the search between this function and {@link processSearchResult}.
	 */
	readonly createSearch:        (config: Config, data: { normalize: NormalizedAst, dataflow: DataflowInformation }) => FlowrSearchLike<Info, GeneratorNames, TransformerNames[], FlowrSearchElements<Info, Elements>>
	/**
	 * Processes the search results of the search created through {@link createSearch}.
	 * This function is expected to return the linting results from this rule for the given search, ie usually the given script file.
	 */
	readonly processSearchResult: (elements: FlowrSearchElements<Info, Elements>, config: Config, data: { normalize: NormalizedAst, dataflow: DataflowInformation, config: FlowrConfigOptions }) => {
		results: Result[],
		'.meta': Metadata
	}
	/**
	 * A set of functions used to pretty-print the given linting result.
	 * By default, the {@link LintingResult#certainty} and whether any {@link LintingResult#quickFix} values are available is automatically printed alongside this information.
	 */
	readonly prettyPrint: { [C in LintingPrettyPrintContext]: (result: Result, metadata: Metadata) => string }
	readonly info:        LinterRuleInformation<NoInfer<Config>>
}

interface BaseQuickFix {
	/**
	 * The type of the quick fix.
	 */
	readonly type:        string
	/**
	 * A short, human-readable description of the quick fix.
	 */
	readonly description: string
	/**
	 * The range of the text that should be replaced.
	 */
	readonly range:       SourceRange
}

export interface LintQuickFixReplacement extends BaseQuickFix {
	readonly type:        'replace'
	/**
	 * The text that should replace the given range.
	 */
	readonly replacement: string
}

export interface LintQuickFixRemove extends BaseQuickFix {
	readonly type: 'remove'
}

export type LintQuickFix = LintQuickFixReplacement | LintQuickFixRemove;

/**
 * A linting result for a single linting rule match.
 */
export interface LintingResult {
	readonly certainty: LintingResultCertainty
	/**
	 * If available, what to do to fix the linting result.
	 */
	readonly quickFix?: LintQuickFix[]
}

export interface ConfiguredLintingRule<Name extends LintingRuleNames = LintingRuleNames> {
	readonly name:   Name
	readonly config: DeepPartial<LintingRuleConfig<Name>>
}

export interface LintingResults<Name extends LintingRuleNames> {
	results: LintingRuleResult<Name>[];
	'.meta': LintingRuleMetadata<Name> & { readonly searchTimeMs: number; readonly processTimeMs: number; };
}

export enum LintingResultCertainty {
	/**
	 * The linting rule cannot say for sure whether the result is correct or not.
	 * This linting certainty should be used for linting results whose calculations are based on estimations involving unknown side-effects, reflection, etc.
	 */
	Uncertain  = 'uncertain',
	/**
	 * The linting rule is certain that the reported lint is real.
	 * This linting certainty should be used for linting results whose calculations do not involve estimates or other unknown factors.
	 */
	Certain = 'certain'
}

export enum LintingRuleCertainty {
	/**
	 * Linting rules that are expected to have both high precision and high recall.
	 */
	Exact = 'exact',
	/**
	 * Linting rules that are expected to have high precision, but not necessarily high recall.
	 * Rules with this certainty generally ensure that the results they return are correct, but may not return all results.
	 */
	BestEffort = 'best-effort',
	/**
	 * Linting rules that are expected to have high recall, but not necessarily high precision.
	 * Rules with this certainty generally return all relevant results, but may also include some incorrect matches.
	 */
	OverApproximative = 'over-approximative'
}

export enum LintingPrettyPrintContext {
	Query = 'query',
	Full = 'full'
}
