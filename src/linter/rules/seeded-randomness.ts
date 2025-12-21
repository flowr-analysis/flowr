import {
	LintingPrettyPrintContext,
	type LintingResult,
	LintingResultCertainty,
	type LintingRule,
	LintingRuleCertainty
} from '../linter-format';
import type { SourceRange } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { formatRange } from '../../util/mermaid/dfg';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { Identifier } from '../../dataflow/environments/identifier';
import { FlowrFilter, testFunctionsIgnoringPackage } from '../../search/flowr-search-filters';
import { DefaultBuiltinConfig } from '../../dataflow/environments/default-builtin-config';
import { type DataflowGraph, getReferenceOfArgument } from '../../dataflow/graph/graph';
import { CascadeAction } from '../../queries/catalog/call-context-query/cascade-action';
import { recoverName } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { LintingRuleTag } from '../linter-tags';
import type { BuiltInFunctionDefinition } from '../../dataflow/environments/built-in-config';
import { resolveIdToValue } from '../../dataflow/eval/resolve/alias-tracking';
import { valueSetGuard } from '../../dataflow/eval/values/general';
import { VariableResolve } from '../../config';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { asValue } from '../../dataflow/eval/values/r-value';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { happensInEveryBranchSet } from '../../dataflow/info';

export interface SeededRandomnessResult extends LintingResult {
	function: string
    range: SourceRange
}

export interface SeededRandomnessConfig extends MergeableRecord {
	/**
	 * A set of functions and variables whose invocation or assignment causes a random seeded to be set.
	 * Each entry has a `type`, which is either `function` or `assignment`, and a `name`, which is the name of the function or variable.
	 * The default value for this is the function `set.seed` and the variable `.Random.seed`.
	 */
    randomnessProducers: {type: 'function' | 'assignment', name: string }[]
	/**
	 * A set of randomness consumer function names that require a seed to be set prior to invocation.
	 */
    randomnessConsumers: string[]
}

export interface SeededRandomnessMeta extends MergeableRecord {
	consumerCalls:                 number
	callsWithFunctionProducers:    number
	callsWithAssignmentProducers:  number
	callsWithNonConstantProducers: number
	callsWithOtherBranchProducers: number
}

export const SEEDED_RANDOMNESS = {
	createSearch: (config) => Q.all()
		.with(Enrichment.CallTargets, { onlyBuiltin: true })
		.filter({
			name: FlowrFilter.MatchesEnrichment,
			args: {
				enrichment: Enrichment.CallTargets,
				test:       testFunctionsIgnoringPackage(config.randomnessConsumers)
			}
		})
		.with(Enrichment.LastCall,[
			{ callName: config.randomnessProducers.filter(p => p.type === 'function').map(p => p.name) },
			{ callName: getDefaultAssignments().flatMap(b => b.names), cascadeIf: () => CascadeAction.Continue }
		]),
	processSearchResult: (elements, config, { dataflow, analyzer }) => {
		const assignmentProducers = new Set<string>(config.randomnessProducers.filter(p => p.type == 'assignment').map(p => p.name));
		const assignmentArgIndexes = new Map<string, number>(getDefaultAssignments().flatMap(a => a.names.map(n => ([n, a.config?.swapSourceAndTarget ? 1 : 0]))));
		const metadata: SeededRandomnessMeta = {
			consumerCalls:                 0,
			callsWithFunctionProducers:    0,
			callsWithAssignmentProducers:  0,
			callsWithNonConstantProducers: 0,
			callsWithOtherBranchProducers: 0
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
				.flatMap(element => {
					const dfgElement = dataflow.graph.getVertex(element.searchElement.node.info.id);
					const cds = dfgElement ? new Set(dfgElement.cds) : new Set();
					const producers = enrichmentContent(element.searchElement, Enrichment.LastCall).linkedIds
						.map(e => dataflow.graph.getVertex(e.node.info.id) as DataflowGraphVertexFunctionCall);
					const { assignment, func } = Object.groupBy(producers, f => assignmentArgIndexes.has(f.name) ? 'assignment' : 'func');
					let nonConstant = false;
					let otherBranch = false;

					// function calls are already taken care of through the LastCall enrichment itself
					for(const f of func ?? []) {
						if(isConstantArgument(dataflow.graph, f, 0, analyzer.inspectContext())) {
							const fCds = new Set(f.cds).difference(cds);
							if(fCds.size <= 0 || happensInEveryBranchSet(fCds)){
								metadata.callsWithFunctionProducers++;
								return [];
							} else {
								otherBranch = true;
							}
						} else {
							nonConstant = true;
						}
					}

					// assignments have to be queried for their destination
					for(const a of assignment ?? []) {
						const argIdx = assignmentArgIndexes.get(a.name) as number;
						const dest = getReferenceOfArgument(a.args[argIdx]);
						if(dest !== undefined && assignmentProducers.has(recoverName(dest, dataflow.graph.idMap) as string)){
							// we either have arg index 0 or 1 for the assignmentProducers destination, so we select the assignment value as 1-argIdx here
							if(isConstantArgument(dataflow.graph, a, 1-argIdx, analyzer.inspectContext())) {
								const aCds = new Set(a.cds).difference(cds);
								if(aCds.size <= 0 || happensInEveryBranchSet(aCds)) {
									metadata.callsWithAssignmentProducers++;
									return [];
								} else {
									otherBranch = true;
								}
							} else {
								nonConstant = true;
							}
						}
					}

					if(nonConstant) {
						metadata.callsWithNonConstantProducers++;
					}
					if(otherBranch) {
						metadata.callsWithOtherBranchProducers++;
					}
					return [{
						certainty: otherBranch ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain,
						function:  element.target,
						range:     element.range
					}];
				}),
			'.meta': metadata
		};
	},
	info: {
		defaultConfig: {
			randomnessProducers: [{ type: 'function', name: 'set.seed' }, { type: 'assignment', name: '.Random.seed' }],
			randomnessConsumers: ['jitter', 'sample', 'sample.int', 'arima.sim', 'kmeans', 'princomp', 'rcauchy', 'rchisq', 'rexp', 'rgamma', 'rgeom', 'rlnorm', 'rlogis', 'rmultinom', 'rnbinom', 'rnorm', 'rpois', 'runif', 'pointLabel', 'some', 'rbernoulli', 'rdunif', 'generateSeedVectors'],
		},
		tags:        [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility],
		// only finds proper randomness producers and consumers due to its config, but will not find all producers/consumers since not all existing deprecated functions will be in the config
		certainty:   LintingRuleCertainty.BestEffort,
		name:        'Seeded Randomness',
		description: 'Checks whether randomness-based function calls are preceded by a random seed generation function. For consistent reproducibility, functions that use randomness should only be called after a constant random seed is set using a function like `set.seed`.'
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result, _meta) => `Function \`${result.function}\` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  (result, _meta) => `Function \`${result.function}\` at ${formatRange(result.range)} is called without a preceding random seed function like \`set.seed\``
	}
} as const satisfies LintingRule<SeededRandomnessResult, SeededRandomnessMeta, SeededRandomnessConfig>;

function getDefaultAssignments(): BuiltInFunctionDefinition<'builtin:assignment'>[] {
	return DefaultBuiltinConfig.filter(b => b.type === 'function' && b.processor == 'builtin:assignment') as BuiltInFunctionDefinition<'builtin:assignment'>[];
}

function isConstantArgument(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, argIndex: number, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	const args = call.args.filter(arg => arg !== EmptyArgument && !arg.name).map(getReferenceOfArgument);
	const values = valueSetGuard(resolveIdToValue(args[argIndex], { graph: graph, resolve: VariableResolve.Alias, ctx }));
	return values?.elements.every(v =>
		v.type === 'number' ||
		v.type === 'logical' ||
		v.type === 'string' ||
		v.type === 'interval' && v.startInclusive && v.endInclusive && v.start.type === 'number' && v.end.type === 'number' && asValue(v.start.value).num === asValue(v.end.value).num)
	       ?? false;
}
