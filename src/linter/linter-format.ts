import type { FlowrSearchLike } from '../search/flowr-search-builder';
import type { FlowrSearchElement, FlowrSearchElements } from '../search/flowr-search';
import type { MergeableRecord } from '../util/objects';
import type { GeneratorNames } from '../search/search-executor/search-generators';
import type { TransformerNames } from '../search/search-executor/search-transformer';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';

export interface LintingRule<Result extends LintingResult, Config extends MergeableRecord = never, Info = ParentInformation, Elements extends FlowrSearchElement<Info>[] = FlowrSearchElement<Info>[]> {
	readonly createSearch:        (config: Config) => FlowrSearchLike<Info, GeneratorNames, TransformerNames[], FlowrSearchElements<Info, Elements>>
	// between these two, there's a chance for the search for multiple rules to be combined or optimized maybe
	readonly processSearchResult: (elements: FlowrSearchElements<Info, Elements>, config: Config) => Result[]
	readonly prettyPrint:         (result: Result) => string
	readonly defaultConfig:       NoInfer<Config>
}

export interface LintingResult {
	readonly certainty: LintingCertainty
}

export const enum LintingCertainty {
	Maybe = 'maybe',
	Definitely = 'definitely'
}
