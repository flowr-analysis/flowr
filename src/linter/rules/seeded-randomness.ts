import type { LintingResult, LintingRule } from '../linter-format';
import { LintingPrettyPrintContext , LintingCertainty } from '../linter-format';
import type { SourceRange } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { Identifier } from '../../dataflow/environments/identifier';
import { FlowrFilter } from '../../search/flowr-search-filters';
import { DefaultBuiltinConfig } from '../../dataflow/environments/default-builtin-config';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { getReferenceOfArgument } from '../../dataflow/graph/graph';
import { isNotUndefined } from '../../util/assert';
import { CascadeAction } from '../../queries/catalog/call-context-query/cascade-action';
import { recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { LintingRuleTag } from '../linter-tags';

export interface SeededRandomnessResult extends LintingResult {
	function: string
    range: SourceRange
}

export interface SeededRandomnessConfig extends MergeableRecord {
    randomnessProducers: {type: 'function' | 'assignment', name: string }[]
    randomnessConsumers: string[]
}

export interface SeededRandomnessMeta extends MergeableRecord {
	consumerCalls:                number
	callsWithFunctionProducers:   number
	callsWithAssignmentProducers: number
}

const assignments = new Set<Identifier>(DefaultBuiltinConfig.filter(b => b.type === 'function' && b.processor == 'builtin:assignment').flatMap(b => b.names));
export const SEEDED_RANDOMNESS = {
	createSearch: (config) => Q.all()
		.with(Enrichment.CallTargets, { onlyBuiltin: true })
		.filter({
			name: FlowrFilter.MatchesEnrichment,
			args: {
				enrichment: Enrichment.CallTargets,
				test:       new RegExp(`"(${config.randomnessConsumers.join('|')})"`)
			}
		})
		.with(Enrichment.LastCall,[
			...config.randomnessProducers.filter(p => p.type === 'function').map(p => ({ callName: p.name })),
			...[...assignments].map(a => ({ callName: a, cascadeIf: () => CascadeAction.Continue }))
		]),
	processSearchResult: (elements, config, { dataflow }) => {
		const assignmentProducers = new Set<string>(config.randomnessProducers.filter(p => p.type == 'assignment').map(p => p.name));
		const metadata: SeededRandomnessMeta = {
			consumerCalls:                0,
			callsWithFunctionProducers:   0,
			callsWithAssignmentProducers: 0
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
					const producers = enrichmentContent(element.searchElement, Enrichment.LastCall).linkedIds
						.map(e => dataflow.graph.getVertex(e.node.info.id) as DataflowGraphVertexFunctionCall);
					const { assignment, func } = Object.groupBy(producers, f => assignments.has(f.name) ? 'assignment' : 'func');

					// function calls are already taken care of through the LastCall enrichment itself
					if(func?.length) {
						metadata.callsWithFunctionProducers++;
						return false;
					}

					// assignments have to be queried for their destination
					// TODO for -> and ->>, this needs to be the 1st arg, see swapSourceAndTarget in the default builtin config
					const assignmentDestinations = assignment?.map(a => getReferenceOfArgument(a.args[0])).filter(isNotUndefined);
					if(assignmentDestinations?.some(d => assignmentProducers.has(recoverName(d, dataflow.graph.idMap) as string))) {
						metadata.callsWithAssignmentProducers++;
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
	info: {
		defaultConfig: {
			randomnessProducers: [{ type: 'function', name: 'set.seed' }, { type: 'assignment', name: '.Random.seed' }],
			randomnessConsumers: ['jitter', 'sample', 'sample.int', 'arima.sim', 'kmeans', 'princomp', 'rcauchy', 'rchisq', 'rexp', 'rgamma', 'rgeom', 'rlnorm', 'rlogis', 'rmultinom', 'rnbinom', 'rnorm', 'rpois', 'runif', 'pointLabel', 'some', 'rbernoulli',
			],
		},
		tags:              [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility],
		humanReadableName: 'Seeded Randomness',
		description:       'Checks whether randomness-based function calls are preceded by a random seed generation function like `set.seed`.'
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Function \`${result.function}\` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  result => `Function \`${result.function}\` at ${formatRange(result.range)} is called without a preceding random seed function like \`set.seed\``
	}
} as const satisfies LintingRule<SeededRandomnessResult, SeededRandomnessMeta, SeededRandomnessConfig>;
