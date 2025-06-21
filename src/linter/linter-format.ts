import type { FlowrSearchLike } from '../search/flowr-search-builder';
import type { FlowrSearchElement, FlowrSearchElements } from '../search/flowr-search';
import type { MergeableRecord } from '../util/objects';
import type { GeneratorNames } from '../search/search-executor/search-generators';
import type { TransformerNames } from '../search/search-executor/search-transformer';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { LintingRuleConfig, LintingRuleMetadata, LintingRuleNames, LintingRuleResult } from './linter-rules';
import type { DataflowInformation } from '../dataflow/info';
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
	readonly processSearchResult: (elements: FlowrSearchElements<Info, Elements>, config: Config, data: { normalize: NormalizedAst, dataflow: DataflowInformation }) => {
		results: Result[],
		'.meta': Metadata
	}
	/**
	 * A function used to pretty-print the given linting result.
	 * By default, the {@link LintingResult#certainty} is automatically printed alongside this information.
	 */
	readonly prettyPrint: (result: Result, metadata: Metadata) => string
	/**
	 * The default config for this linting rule.
	 * The default config is combined with the user config when executing the rule.
	 */
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
	readonly certainty: LintingCertainty
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

export enum LintingCertainty {
	/**
	 * The linting rule cannot say for sure whether the result is correct or not.
	 */
	Maybe = 'maybe',
	/**
	 * The linting rule is certain that the reported lint is real.
	 */
	Definitely = 'definitely'
}
