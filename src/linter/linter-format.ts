import type { FlowrSearch } from '../search/flowr-search-builder';
import type { FlowrSearchElements } from '../search/flowr-search';
import type { NoInfo } from '../r-bridge/lang-4.x/ast/model/model';
import type { MergeableRecord } from '../util/objects';
import type { R1_DEPRECATED_FUNCTIONS } from './rules/1-deprecated-functions';

export interface LintingRule<Result extends LintingResult, Config extends MergeableRecord = never, Info = NoInfo> {
	readonly name:                string
	readonly createSearch:        (config: Config) => FlowrSearch<Info>
	// between these two, there's a chance for the search for multiple rules to be combined or optimized or smth maybe? who knows
	readonly processSearchResult: (elements: FlowrSearchElements<Info>, config: Config) => Result[]
	readonly printers:            { [O in LintingOutput]?: (result: Result, config: Config) => string }
}

export type LintingRules = typeof R1_DEPRECATED_FUNCTIONS
export type LintingRuleNames = LintingRules['name']

export interface LintingResult {
	readonly certainty: LintingCertainty
}

export enum LintingCertainty {
	Maybe = 'maybe',
	Definitely = 'definitely'
}

export enum LintingOutput {
	Text = 'text',
	Json = 'json'
}
