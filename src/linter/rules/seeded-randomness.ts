import {
	LintingPrettyPrintContext,
	type LintingResult,
	LintingResultCertainty,
	type LintingRule,
	LintingRuleCertainty
} from '../linter-format';
import { SourceLocation, SourceRange } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { BrandedIdentifier } from '../../dataflow/environments/identifier';
import { Identifier } from '../../dataflow/environments/identifier';
import { FlowrFilter } from '../../search/flowr-search-filters';
import { type DataflowGraph, FunctionArgument } from '../../dataflow/graph/graph';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { LintingRuleTag } from '../linter-tags';
import type { BuiltInDefinitions, BuiltInFunctionDefinition } from '../../dataflow/environments/built-in-config';
import { NodeValue } from '../../dataflow/eval/resolve/node-value';
import { VariableResolve } from '../../config';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { asValue } from '../../dataflow/eval/values/r-value';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { ControlDependency, happensInEveryBranch } from '../../dataflow/info';
import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import { EdgeType } from '../../dataflow/graph/edge';
import { edgeSources, edgeTargets } from '../../dataflow/fn/frame-reflection';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { Ternary } from '../../util/logic';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { CallProp, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import type { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import { Resolve } from '../../dataflow/environments/resolve-helper';

export interface SeededRandomnessResult extends LintingResult {
	function: string
}

export interface SeededRandomnessConfig extends MergeableRecord {
	/**
	 * A set of functions and variables whose invocation or assignment causes a random seeded to be set.
	 * Each entry has a `type`, which is either `function` or `assignment`, and a `name`, which is the name of the function or variable.
	 * The default value for this is the function `set.seed` and the variable `.Random.seed`.
	 */
	randomnessProducers: { type: 'function' | 'assignment', name: string }[]
	/**
	 * A set of randomness consumer function names that require a seed to be set prior to invocation.
	 */
	randomnessConsumers: readonly string[]
}

export interface SeededRandomnessMeta extends MergeableRecord {
	consumerCalls:                 number
	callsWithFunctionProducers:    number
	callsWithAssignmentProducers:  number
	callsWithNonConstantProducers: number
	callsWithOtherBranchProducers: number
}

export const SEEDED_RANDOMNESS = {
	createSearch: config => Q.all().filter(VertexType.FunctionCall)
		.with(Enrichment.CallTargets, {
			onlyBuiltin:  true,
			qualifyNames: false // we don't use qualified names for this rule yet
		})
		.filter({
			name: FlowrFilter.MatchesEnrichment,
			args: {
				enrichment: Enrichment.CallTargets,
				test:       { targets: Identifier.regex(...config.randomnessConsumers) }
			}
		}),
	processSearchResult: async(elements, config, data) => {
		const { graph } = await data.dataflow();
		const ctx = data.inspectContext();
		const functionProducers = new Set(config.randomnessProducers.filter(p => p.type === 'function').map(p => p.name));
		const assignmentProducers = new Set(config.randomnessProducers.filter(p => p.type === 'assignment').map(p => p.name));
		const consumers = new Set(config.randomnessConsumers);
		const assignmentArgIndexes = ctx.env.deriveFromDefinitions(assignmentTargetIndexes);
		const metadata: SeededRandomnessMeta = {
			consumerCalls:                 0,
			callsWithFunctionProducers:    0,
			callsWithAssignmentProducers:  0,
			callsWithNonConstantProducers: 0,
			callsWithOtherBranchProducers: 0
		};

		const writerKind = (vertex: DataflowGraphVertexFunctionCall): { kind: 'function' | 'assignment', constant: boolean } | 'draw' | undefined => {
			const name = Identifier.getName(vertex.name);
			if(functionProducers.has(name)) {
				return { kind: 'function', constant: isConstantArgument(graph, vertex, 0, ctx) };
			}
			const argIdx = assignmentArgIndexes.get(name);
			if(argIdx === undefined) {
				return consumers.has(name) ? 'draw' : undefined;
			}
			const dest = FunctionArgument.getReference(vertex.args[argIdx]);
			if(dest === undefined || !assignmentProducers.has(NodeId.recoverName(dest, graph.idMap) as string)) {
				return undefined;
			}
			/* we either have arg index 0 or 1 for the destination, so the value is at 1-argIdx */
			return { kind: 'assignment', constant: isConstantArgument(graph, vertex, 1 - argIdx, ctx) };
		};

		const idMap = graph.idMap;
		const forcing = FunctionSemantics.promiseForcing(graph, { ctx });
		const at = (n: NodeId) => idMap?.get(n)?.location ?? [0, 0, 0, 0];
		/** whether `writer` follows `reader` within a loop both run under, so it reaches the reader from the second iteration on */
		const loopCarried = (reader: NodeId, writer: NodeId): boolean => {
			if(SourceRange.compare(at(writer), at(reader)) <= 0) {
				return false;
			}
			const writerCds = graph.getVertex(writer)?.cds;
			const loops = graph.getVertex(reader)?.cds?.filter(cd => ControlDependency.isIterated(cd, idMap)) ?? [];
			return loops.some(loop => writerCds?.some(cd => ControlDependency.same(cd, loop)));
		};

		interface Seeding {
			/** the constant seeds that reach the call, by how they were set */
			readonly seeds: { readonly function: Set<NodeId>, readonly assignment: Set<NodeId> }
			nonConstant:    boolean
			/** whether a seed reaches the call only on some of the ways there */
			otherBranch:    boolean
			/** whether the call may see a state no constant seed set: the initial one, or a non-constant seed */
			unseeded:       boolean
		}
		/** a call of a draw by another name, like a parameter `f` bound to `runif` */
		const drawsThrough = (call: NodeId): 'draw' | undefined =>
			edgeTargets(graph, call, EdgeType.Calls).some(t => NodeId.isBuiltIn(t) && consumers.has(NodeId.fromBuiltIn(t))) ? 'draw' : undefined;
		/** the writes a draw reads the generator state from: its own, and those of the calls running the function it sits in, which link what was written before them */
		const statesReadBy = (id: NodeId): NodeId[] => {
			const within = idMap === undefined ? undefined : RNode.findEnclosing(id, idMap, RFunctionDefinition.is);
			const callers = within === undefined ? [] : edgeSources(graph, within, EdgeType.Calls);
			const ownReads = edgeTargets(graph, id, EdgeType.Reads | EdgeType.DefinedByOnCall);
			return [...ownReads, ...callers.flatMap(c => edgeTargets(graph, c, EdgeType.DefinedByOnCall))];
		};
		/** follows the draws behind the generator state `id` reads back to where it was seeded */
		const collectSeeding = (id: NodeId, visiting: ReadonlySet<NodeId>, seeding: Seeding): Seeding => {
			const own = new Set(graph.getVertex(id)?.cds);
			const cds: ControlDependency[] = [];
			let written = false;
			let always = false;
			for(const target of statesReadBy(id)) {
				const writer = graph.getVertex(target);
				const kind = DfgVertex.isFunctionCall(writer) && !visiting.has(target) ? writerKind(writer) ?? drawsThrough(target) : undefined;
				if(kind === undefined) {
					continue;
				}
				/* a write later in the same loop body reaches the call from the second iteration on only */
				if(loopCarried(id, target)) {
					seeding.otherBranch = seeding.unseeded = true;
				} else {
					written = true;
				}
				/* a promise surely forced is no condition */
				const conditions = new Set(writer?.cds?.filter(cd => cd.byPromise !== true || forcing(cd.id, target) !== Ternary.Always)).difference(own);
				always ||= conditions.size === 0;
				cds.push(...conditions);
				if(kind === 'draw') {
					collectSeeding(target, new Set([...visiting, id]), seeding);
				} else if(kind.constant) {
					seeding.seeds[kind.kind].add(target);
				} else {
					seeding.nonConstant = seeding.unseeded = true;
				}
			}
			/* the state the program starts with is seen wherever no write reaches for sure */
			if(!written) {
				seeding.unseeded = true;
			} else if(!always && !happensInEveryBranch(cds)) {
				seeding.otherBranch = seeding.unseeded = true;
			}
			return seeding;
		};

		return {
			results: elements.getElements().flatMap(element => enrichmentContent(element, Enrichment.CallTargets).targets.flatMap(target => {
				metadata.consumerCalls++;
				const id = element.node.info.id;
				const seeding = collectSeeding(id, new Set(), {
					seeds:       { function: new Set(), assignment: new Set() },
					nonConstant: false,
					otherBranch: false,
					unseeded:    false
				});
				metadata.callsWithFunctionProducers += seeding.seeds.function.size;
				metadata.callsWithAssignmentProducers += seeding.seeds.assignment.size;
				if(!seeding.unseeded) {
					return [];
				}
				if(seeding.nonConstant) {
					metadata.callsWithNonConstantProducers++;
				}
				if(seeding.otherBranch) {
					metadata.callsWithOtherBranchProducers++;
				}
				/* a call in a function body is seeded by what its callers did first (`set.seed(1); sapply(1:3, function(i) runif(1))`),
				   so only a call the program itself reaches can be unseeded for certain */
				const nested = !graph.isRoot(id);
				const someSeed = seeding.seeds.function.size + seeding.seeds.assignment.size > 0;
				return [{
					involvedId: id,
					certainty:  someSeed || nested ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain,
					function:   target as BrandedIdentifier,
					loc:        SourceLocation.fromNode(element.node) ?? SourceLocation.invalid()
				}];
			})),
			'.meta': metadata
		};
	},
	info: {
		defaultConfig: ctx => ({
			randomnessProducers: [
				...ctx.env.deriveFromIndex(randomnessSetters).map(name => ({ type: 'function', name }) as const),
				{ type: 'assignment', name: '.Random.seed' }
			],
			randomnessConsumers: [
				...ctx.env.deriveFromIndex(randomnessConsumers),
				'princomp', 'pointLabel', 'rbernoulli', 'rdunif', 'generateSeedVectors', 'rvonmises',
				'rxor', 'rmvnorm', 'randomForest',
				'permuted', 'permute', 'shuffle', 'shuffleSet', 'data_shuffle', 'sample_frac', 'sample_n',
			],
		}),
		tags:        [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility],
		// only finds proper randomness producers and consumers due to its config, but will not find all producers/consumers since not all existing deprecated functions will be in the config
		certainty:   LintingRuleCertainty.BestEffort,
		name:        'Seeded Randomness',
		description: 'Checks whether randomness-based function calls are preceded by a random seed generation function. For consistent reproducibility, functions that use randomness should only be called after a constant random seed is set using a function like `set.seed`.'
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result, _meta) => `Function \`${result.function}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  (result, _meta) => `Function \`${result.function}\` at ${SourceLocation.format(result.loc)} is called without a preceding random seed function like \`set.seed\``
	}
} as const satisfies LintingRule<SeededRandomnessResult, SeededRandomnessMeta, SeededRandomnessConfig>;

function getDefaultAssignments(definitions: BuiltInDefinitions): BuiltInFunctionDefinition<BuiltInProcName.Assignment | BuiltInProcName.AssignmentLike>[] {
	return definitions.filter((b): b is BuiltInFunctionDefinition<BuiltInProcName.Assignment | BuiltInProcName.AssignmentLike> =>
		b.type === 'function' && (b.processor === BuiltInProcName.Assignment || b.processor === BuiltInProcName.AssignmentLike));
}

function assignmentTargetIndexes(definitions: BuiltInDefinitions): Map<string, number> {
	return new Map(getDefaultAssignments(definitions).flatMap(a => {
		const targetIndex = a.config?.swapSourceAndTarget ? 1 : 0;
		return a.names.map(n => [Identifier.getName(n), targetIndex] as const);
	}));
}

function randomnessSetters(index: BuiltInIndex): string[] {
	return index.withAll([SemanticCallTag.Random, CallProp.Configures]).map(Identifier.getName);
}

function randomnessConsumers(index: BuiltInIndex): string[] {
	const setters = new Set(randomnessSetters(index));
	return index.with(SemanticCallTag.Random).map(Identifier.getName).filter(n => !setters.has(n));
}

function isConstantArgument(graph: DataflowGraph, call: DataflowGraphVertexFunctionCall, argIndex: number, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	const args = call.args.filter(arg => arg !== EmptyArgument && !arg.name).map(FunctionArgument.getReference);
	const values = NodeValue.setOf(args[argIndex], Resolve.info(graph, ctx), { resolve: VariableResolve.Alias });
	return values?.elements.every(v =>
		v.type === 'number' ||
		v.type === 'logical' ||
		v.type === 'string' ||
		v.type === 'interval' && v.startInclusive && v.endInclusive && v.start.type === 'number' && v.end.type === 'number' && asValue(v.start.value).num === asValue(v.end.value).num)
	       ?? false;
}
