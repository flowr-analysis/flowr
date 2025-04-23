import type { FlowrSearchLike } from '../search/flowr-search-builder';
import type { FlowrSearchElement, FlowrSearchElements } from '../search/flowr-search';
import type { MergeableRecord } from '../util/objects';
import type { GeneratorNames } from '../search/search-executor/search-generators';
import type { TransformerNames } from '../search/search-executor/search-transformer';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { LintingRuleConfig, LintingRuleNames } from './linter-rules';
import type { DataflowInformation } from '../dataflow/info';

export interface LintingRule<Result extends LintingResult, Config extends MergeableRecord = never, Info = ParentInformation, Elements extends FlowrSearchElement<Info>[] = FlowrSearchElement<Info>[]> {
	readonly createSearch:        (config: Config, data: { normalize: NormalizedAst, dataflow: DataflowInformation }) => FlowrSearchLike<Info, GeneratorNames, TransformerNames[], FlowrSearchElements<Info, Elements>>
	// between these two, there's a chance for the search for multiple rules to be combined or optimized maybe
	readonly processSearchResult: (elements: FlowrSearchElements<Info, Elements>, config: Config, data: { normalize: NormalizedAst, dataflow: DataflowInformation }) => Result[]
	readonly prettyPrint:         (result: Result) => string
	readonly defaultConfig:       NoInfer<Config>
}

export interface LintingResult {
	readonly certainty: LintingCertainty
}

export interface ConfiguredLintingRule<Name extends LintingRuleNames = LintingRuleNames> {
	readonly name:   Name
	readonly config: LintingRuleConfig<Name>
}


export enum LintingCertainty {
	Maybe = 'maybe',
	Definitely = 'definitely'
}
