import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext , LintingCertainty } from '../linter-format';
import type { SourceRange } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { Identifier } from '../../dataflow/environments/identifier';
import { FlowrFilter } from '../../search/flowr-search-filters';

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
		.with(Enrichment.CallTargets, { onlyBuiltin: true })
		.filter({
			name: FlowrFilter.MatchesEnrichment,
			args: {
				enrichment: Enrichment.CallTargets,
				test:       new RegExp(`"(${config.randomnessConsumers.join('|')})"`)
			}
		})
		.with(Enrichment.LastCall, config.randomnessProducers.map(f => ({ callName: f }))),
	processSearchResult: (elements) => {
		const metadata: SeededRandomnessMeta = {
			consumerCalls:      0,
			callsWithProducers: 0
		};
		return {
			results: elements.getElements()
				// map and filter consumers
				.flatMap(element => enrichmentContent(element, Enrichment.CallTargets).targets.map(target => {
					metadata.consumerCalls++;
					return {
						range:         element.node.info.fullRange as SourceRange,
						target:        target as Identifier,
						searchElement: element
					};
				}))
				// filter by calls that aren't preceded by a randomness producer
				.filter(element => {
					const producers = enrichmentContent(element.searchElement, Enrichment.LastCall).linkedIds;
					if(producers.length > 0/* && producers.some(p => (p.node as RFunctionCall).arguments.all(a => resolveToConstants()))*/){
						metadata.callsWithProducers++;
						return false;
					}
					return true;
				})

				.map(element => ({
					certainty: LintingCertainty.Definitely,
					function:  element.target,
					range:     element.range
				})),
			'.meta': metadata
		};
	},
	defaultConfig: {
		randomnessProducers: ['set.seed'],
		randomnessConsumers: ['jitter', 'sample', 'sample.int', 'arima.sim', 'kmeans', 'princomp', 'rcauchy', 'rchisq', 'rexp', 'rgamma', 'rgeom', 'rlnorm', 'rlogis', 'rmultinom', 'rnbinom', 'rnorm', 'rpois', 'runif', 'pointLabel', 'some', 'rbernoulli',
		],
	},
	humanReadableName: 'Seeded Randomness',
	prettyPrint:       {
		[LintingPrettyPrintContext.Query]: result => `Function \`${result.function}\` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  result => `Function \`${result.function}\` at ${formatRange(result.range)} is called without a preceding random seed function like \`set.seed\``
	}
} as const satisfies LintingRule<SeededRandomnessResult, SeededRandomnessMeta, SeededRandomnessConfig>;
