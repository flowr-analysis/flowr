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
import { CascadeAction } from '../../queries/catalog/call-context-query/cascade-action';
import { recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { LintingRuleTag } from '../linter-tags';
import type { BuiltInFunctionDefinition } from '../../dataflow/environments/built-in-config';
import { getValueOfArgument } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';

export interface SeededRandomnessResult extends LintingResult {
	function: string
    range: SourceRange
}

export interface SeededRandomnessConfig extends MergeableRecord {
    randomnessProducers: {type: 'function' | 'assignment', name: string }[]
    randomnessConsumers: string[]
}

export interface SeededRandomnessMeta extends MergeableRecord {
	consumerCalls:                 number
	callsWithFunctionProducers:    number
	callsWithAssignmentProducers:  number
	callsWithNonConstantProducers: number
}

const assignments = DefaultBuiltinConfig.filter(b => b.type === 'function' && b.processor == 'builtin:assignment') as BuiltInFunctionDefinition<'builtin:assignment'>[];
const assignmentSet = new Set<Identifier>(assignments.flatMap(b => b.names));
const assignmentArgIndexes = new Map<string, number>(assignments.flatMap(a => a.names.map(n => ([n, a.config?.swapSourceAndTarget ? 1 : 0]))));

export const SEEDED_RANDOMNESS = {
	createSearch: (config) => Q.all()
		.with(Enrichment.CallTargets, { onlyBuiltin: true })
		.filter({
			name: FlowrFilter.MatchesEnrichment,
			args: {
				enrichment: Enrichment.CallTargets,
				test:       new RegExp(`"(.+:::?)?(${config.randomnessConsumers.join('|')})"`)
			}
		})
		.with(Enrichment.LastCall,[
			...config.randomnessProducers.filter(p => p.type === 'function').map(p => ({ callName: p.name })),
			...[...assignmentSet].map(a => ({ callName: a, cascadeIf: CascadeAction.Continue }))
		]),
	processSearchResult: (elements, config, { dataflow }) => {
		const assignmentProducers = new Set<string>(config.randomnessProducers.filter(p => p.type == 'assignment').map(p => p.name));
		const metadata: SeededRandomnessMeta = {
			consumerCalls:                 0,
			callsWithFunctionProducers:    0,
			callsWithAssignmentProducers:  0,
			callsWithNonConstantProducers: 0
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
					const { assignment, func } = Object.groupBy(producers, f => assignmentSet.has(f.name) ? 'assignment' : 'func');
					let nonConstant = false;

					// function calls are already taken care of through the LastCall enrichment itself
					for(const f of func ?? []) {
						if(getValueOfArgument(dataflow.graph, f, { index: 0 }, [RType.Number, RType.String, RType.Logical]) !== undefined) {
							metadata.callsWithFunctionProducers++;
							return false;
						} else {
							nonConstant = true;
						}
					}

					// assignments have to be queried for their destination
					for(const a of assignment ?? []) {
						const argIdx = assignmentArgIndexes.get(a.name) as number;
						const dest = getReferenceOfArgument(a.args[argIdx]);
						if(dest !== undefined && assignmentProducers.has(recoverName(dest, dataflow.graph.idMap) as string)){
							if(getValueOfArgument(dataflow.graph, a, { index: 1-argIdx }, [RType.Number, RType.String, RType.Logical]) !== undefined) {
								metadata.callsWithAssignmentProducers++;
								return false;
							} else {
								nonConstant = true;
							}
						}
					}

					if(nonConstant) {
						metadata.callsWithNonConstantProducers++;
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
			randomnessConsumers: ['jitter', 'sample', 'sample.int', 'arima.sim', 'kmeans', 'princomp', 'rcauchy', 'rchisq', 'rexp', 'rgamma', 'rgeom', 'rlnorm', 'rlogis', 'rmultinom', 'rnbinom', 'rnorm', 'rpois', 'runif', 'pointLabel', 'some', 'rbernoulli', 'rdunif', 'generateSeedVectors'],
		},
		tags:        [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility],
		name:        'Seeded Randomness',
		description: 'Checks whether randomness-based function calls are preceded by a random seed generation function like `set.seed`.'
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result, _meta) => `Function \`${result.function}\` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  (result, _meta) => `Function \`${result.function}\` at ${formatRange(result.range)} is called without a preceding random seed function like \`set.seed\``
	}
} as const satisfies LintingRule<SeededRandomnessResult, SeededRandomnessMeta, SeededRandomnessConfig>;
