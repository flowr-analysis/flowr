import type { FlowrSearchLike } from '../search/flowr-search-builder';
import type { FlowrSearchElement, FlowrSearchElements } from '../search/flowr-search';
import type { MergeableRecord } from '../util/objects';
import type { GeneratorNames } from '../search/search-executor/search-generators';
import type { TransformerNames } from '../search/search-executor/search-transformer';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { LintingRuleConfig, LintingRuleMetadata, LintingRuleNames, LintingRuleResult } from './linter-rules';
import type { DataflowInformation } from '../dataflow/info';
import type { DeepPartial } from 'ts-essentials';
import type { FlowrConfigOptions } from '../config';

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
	 * A function used to pretty-print the given linting result.
	 * By default, the {@link LintingResult#certainty} is automatically printed alongside this information.
	 */
	readonly prettyPrint:   (result: Result, metadata: Metadata) => string
	/**
	 * The default config for this linting rule.
	 * The default config is combined with the user config when executing the rule.
	 */
	readonly defaultConfig: NoInfer<Config>
}

/**
 * A linting result for a single linting rule match.
 */
export interface LintingResult {
	readonly certainty: LintingCertainty
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
	Maybe = 'maybe',
	Definitely = 'definitely'
}
