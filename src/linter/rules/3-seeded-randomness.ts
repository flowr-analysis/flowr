import type { LintingResult ,  LintingRule } from '../linter-format';
import  { LintingCertainty } from '../linter-format';
import type { SourceRange } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { Identifier } from '../../dataflow/environments/identifier';

export interface SeededRandomnessResult extends LintingResult {
	function: string
    range: SourceRange
}

export interface SeededRandomnessConfig extends MergeableRecord {
    randomnessProducers: string[]
    randomnessConsumers: string[]
}

export interface SeededRandomnessMeta extends MergeableRecord {
	consumerCalls:      number
	callsWithProducers: number
}

export const R3_SEEDED_RANDOMNESS = {
	createSearch: (config) => Q.all()
		.with(Enrichment.CallTargets)
		.with(Enrichment.LastCall, config.randomnessProducers.map(f => ({ callName: f }))),
	processSearchResult: (elements, config) => {
		const metadata: SeededRandomnessMeta = {
			consumerCalls:      0,
			callsWithProducers: 0
		};
		return {
			results: elements.getElements()
				// map and filter consumers
				.flatMap(element => {
					const potentialConsumers = enrichmentContent(element, Enrichment.CallTargets).targets;
					// if there is a call target that is not built-in (ie a custom function), we don't want to include it here
					// eventually we'd want to solve this with an argument to the CallTargets enrichment like satisfiesCallTargets does!
					if(potentialConsumers.some(t => typeof t !== 'string')) {
						return [];
					}
					return potentialConsumers.map(target => ({
						range:         element.node.info.fullRange as SourceRange,
						target:        target as Identifier,
						searchElement: element
					}));
				})
				.filter(element => {
					if(config.randomnessConsumers.includes(element.target)) {
						metadata.consumerCalls++;
						return true;
					} else {
						return false;
					}
				})

				// filter by calls that aren't preceded by a randomness producer
				.filter(element => {
					const producers = enrichmentContent(element.searchElement, Enrichment.LastCall).linkedIds;
					if(producers.length <= 0) {
						return true;
					} else {
						metadata.callsWithProducers++;
						return false;
					}
				})

				.map(element => ({
					certainty: LintingCertainty.Definitely,
					function:  element.target,
					range:     element.range
				})),
			'.meta': metadata
		};
	},
	prettyPrint:   result => `at ${formatRange(result.range)}`,
	defaultConfig: {
		randomnessProducers: ['set.seed'],
		randomnessConsumers: ['runif'],
	}
} as const satisfies LintingRule<SeededRandomnessResult, SeededRandomnessMeta, SeededRandomnessConfig>;
