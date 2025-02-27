import type { FlowrSearchLike } from '../search/flowr-search-builder';
import type { FlowrSearchElements } from '../search/flowr-search';
import type { NoInfo } from '../r-bridge/lang-4.x/ast/model/model';
import type { MergeableRecord } from '../util/objects';
import type { R1_DEPRECATED_FUNCTIONS } from './rules/1-deprecated-functions';

export interface LintingRule<Result extends LintingResult, Config extends MergeableRecord = never, Info = NoInfo> {
	readonly name:                string
	readonly createSearch:        (config: Config) => FlowrSearchLike<Info>
	// between these two, there's a chance for the search for multiple rules to be combined or optimized or smth maybe? who knows
	// TODO i think the cool type safety stuff is lost between these two, what do we do about that
	readonly processSearchResult: (elements: FlowrSearchElements<Info>, config: Config) => Result[]
	readonly printers:            { [O in LintingPrintStyle]?: (result: Result, config: Config) => string }
}

// TODO this way doesn't have the ability to add additional linting rules from a third party lib (right?) so that may be bad
export type LintingRules = typeof R1_DEPRECATED_FUNCTIONS
export type LintingRuleNames = LintingRules['name']

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
