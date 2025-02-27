import type { FlowrSearchLike } from '../search/flowr-search-builder';
import type { FlowrSearchElement, FlowrSearchElements } from '../search/flowr-search';
import type { NoInfo } from '../r-bridge/lang-4.x/ast/model/model';
import type { MergeableRecord } from '../util/objects';
import type { R1_DEPRECATED_FUNCTIONS } from './rules/1-deprecated-functions';
import type { GeneratorNames } from '../search/search-executor/search-generators';
import type { TransformerNames } from '../search/search-executor/search-transformer';

export interface LintingRule<Result extends LintingResult, Config extends MergeableRecord = never, Info = NoInfo, Elements extends FlowrSearchElement<Info>[] = FlowrSearchElement<Info>[]> {
	readonly name:                string
	readonly createSearch:        (config: Config) => FlowrSearchLike<Info, GeneratorNames, TransformerNames[], FlowrSearchElements<Info, Elements>>
	// between these two, there's a chance for the search for multiple rules to be combined or optimized maybe
	readonly processSearchResult: (elements: FlowrSearchElements<Info, Elements>, config: Config) => Result[]
	readonly printers:            { [O in LintingPrintStyle]?: (result: Result, config: Config) => string }
}

export type DefaultLintingRules = typeof R1_DEPRECATED_FUNCTIONS
export type DefaultLintingRuleNames = DefaultLintingRules['name']

export interface LintingResult {
	readonly certainty: LintingCertainty
}

export enum LintingCertainty {
	Maybe = 'maybe',
	Definitely = 'definitely'
}

export enum LintingPrintStyle {
	Text = 'text',
	Json = 'json'
}
