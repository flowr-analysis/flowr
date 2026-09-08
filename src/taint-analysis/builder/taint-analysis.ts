import type { FlowrAnalyzer, ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import type { TaintAnalysisDefinition, CompositeTaintAnalysisDefinition, RunnableTaintAnalysisDefinition } from './taint-analysis-definition';
import type { AnyPredefinedTaintAnalysisName } from '../predefined/predefined';
import { predefinedTaintAnalyses } from '../predefined/predefined';
import type { StateAbstractDomain } from '../../abstract-interpretation/domains/state-abstract-domain';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { AnyStateDomain } from '../../abstract-interpretation/domains/state-domain-like';
import type { RNamedFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { TaintRole } from '../function-mapper';
import type { ArgTaintProjector, TaintVisitorConfiguration, TaintVisitorHook } from '../taint-visitor';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { SourceLocation } from '../../util/range';
import { guard, isNotUndefined } from '../../util/assert';

/**
 * Information passed to a {@link FnCallHook} for each function call visited during taint analysis.
 */
export interface FnCallHookInfo {
	/** The name of the taint analysis */
	name:       string;
	/** The role of the matched mapping (source/propagator/sink), or `undefined` for unmapped calls */
	role:       TaintRole | undefined;
	/** The AST node representing the function call */
	node:       RNamedFunctionCall<ParentInformation>;
	/** Whether the function call had an explicit mapping */
	wasMapped:  boolean;
	/** The abstract domain value at this point (the outgoing/resolved taint) */
	value:      AnyAbstractDomain;
	/** Resolves the incoming taint of any argument node at this call, regardless of mapping rules */
	projectArg: ArgTaintProjector;
	/** The data flow graph vertex of the function call */
	call:       DataflowGraphVertexFunctionCall;
	/** The data flow graph (e.g. for resolving the call's arguments) */
	dfg:        DataflowGraph;
	/** The analysis context (e.g. for resolving argument values) */
	ctx:        ReadOnlyFlowrAnalyzerContext;
}

/**
 * Callback hook invoked when a function call is visited during taint analysis.
 */
export type FnCallHook = (info: FnCallHookInfo) => void;

/**
 * A single finding produced by a taint analysis, i.e. an AST node whose inferred taint reached Bottom (e.g. a sink call).
 */
export interface TaintFinding {
	/** The AST node ID that reached Bottom */
	nodeId: NodeId
	/** The source location of the AST node, if it could be resolved */
	loc?:   SourceLocation
}

/**
 * Result of running a taint analysis, containing the final abstract domain state and any findings.
 */
export interface TaintInferenceResult {
	/** The final abstract domain state after running the taint analysis visitor */
	domains:  StateAbstractDomain<AnyAbstractDomain>
	/** The message describing the findings */
	msg?:     string
	/** The findings produced by the analysis, i.e. one per AST node whose inferred taint reached Bottom */
	findings: TaintFinding[]
}

/**
 * Builder stage of a taint analysis, before any analysis definition has been added.
 * {@link RunnableTaintAnalysis.run} only becomes available once
 * {@link add}, {@link addComposite}, or {@link addPredefined} has been called.
 */
export interface TaintAnalysisBuilder<Defs extends readonly string[]> {
	/**
	 * Add a callback hook that is invoked for each function call mapping during taint analysis.
	 */
	withHook(fnCallHook: FnCallHook): this;

	/**
	 * Add a predefined taint analysis by name.
	 */
	addPredefined<Name extends AnyPredefinedTaintAnalysisName>(name: Name): RunnableTaintAnalysis<readonly [...Defs, Name]>;

	/**
	 * Add a custom taint analysis definition.
	 */
	add<Name extends string>(def: TaintAnalysisDefinition<Name>): RunnableTaintAnalysis<readonly [...Defs, Name]>;

	/**
	 * Add a composite taint analysis that combines multiple taint analyses into a product of their lattice values.
	 * @see {@link TaintAnalysisDefinition.compose} to create a composite taint analysis definition.
	 */
	addComposite<Name extends string>(def: CompositeTaintAnalysisDefinition<Name>): RunnableTaintAnalysis<readonly [...Defs, Name]>;
}

export interface RunnableTaintAnalysis<Defs extends readonly string[]> extends TaintAnalysisBuilder<Defs> {
	run(analyzer?: ReadonlyFlowrAnalysisProvider): Promise<Map<Defs[number], TaintInferenceResult>>;
}

/**
 * Fluent builder class for conducting taint analyses.
 * Please prefer using the {@link FlowrAnalyzer.taint} method to create a taint analysis.
 * Use {@link TaintAnalysis.create} to obtain an instance; {@link TaintAnalysis.run} is only reachable
 * after at least one of {@link add}, {@link addComposite}, or {@link addPredefined} has been called.
 */
export class TaintAnalysis<Defs extends readonly string[] = []> implements RunnableTaintAnalysis<Defs> {
	private readonly analyzer?: ReadonlyFlowrAnalysisProvider;
	private readonly defs:      RunnableTaintAnalysisDefinition<Defs[number]>[] = [];
	private fnCallHook:         FnCallHook | undefined;

	private constructor(analyzer?: ReadonlyFlowrAnalysisProvider) {
		this.analyzer = analyzer;
	}

	/**
	 * Create a new taint analysis builder. {@link run} is unreachable on the result until at least
	 * one of {@link add}, {@link addComposite}, or {@link addPredefined} has been called on it.
	 */
	public static create<Defs extends readonly string[] = []>(analyzer?: ReadonlyFlowrAnalysisProvider): TaintAnalysisBuilder<Defs> {
		return new TaintAnalysis<Defs>(analyzer);
	}

	public withHook(fnCallHook: FnCallHook): this {
		this.fnCallHook = fnCallHook;
		return this;
	}

	public addPredefined<Name extends AnyPredefinedTaintAnalysisName>(name: Name): RunnableTaintAnalysis<readonly [...Defs, Name]> {
		this.defs.push(predefinedTaintAnalyses[name]);
		return this as unknown as RunnableTaintAnalysis<readonly [...Defs, Name]>;
	}

	public add<Name extends string>(def: TaintAnalysisDefinition<Name>): RunnableTaintAnalysis<readonly [...Defs, Name]> {
		this.defs.push(def);
		return this as unknown as RunnableTaintAnalysis<readonly [...Defs, Name]>;
	}

	public addComposite<Name extends string>(def: CompositeTaintAnalysisDefinition<Name>): RunnableTaintAnalysis<readonly [...Defs, Name]> {
		this.defs.push(def);
		return this as unknown as RunnableTaintAnalysis<readonly [...Defs, Name]>;
	}

	/**
	 * Run one or multiple taint analyses.
	 */
	public async run(analyzer?: ReadonlyFlowrAnalysisProvider): Promise<Map<Defs[number], TaintInferenceResult>> {
		const priorityAnalyzer = analyzer ?? this.analyzer;
		guard(isNotUndefined(priorityAnalyzer), 'No analyzer has been set');

		const results: Map<Defs[number], TaintInferenceResult> = new Map();
		const dfg = (await priorityAnalyzer.dataflow()).graph;
		const ctx = priorityAnalyzer.inspectContext();
		for(const def of this.defs) {
			const baseConfig: TaintVisitorConfiguration = {
				controlFlow:   await priorityAnalyzer.controlflow(),
				ctx:           ctx,
				dfg:           dfg,
				normalizedAst: await priorityAnalyzer.normalize(),
				fnCallHook:    this.wrapFnCallHook(this.fnCallHook, def.name, dfg, ctx),
			};

			const visitor = def.createVisitor(baseConfig);
			visitor.start();

			const endState = visitor.getEndState();
			const msg = def.msg;
			const findings: TaintFinding[] = msg === undefined ? [] : endState.getBottomNodes().map(nodeId => ({
				nodeId,
				loc: SourceLocation.fromNode(baseConfig.normalizedAst.idMap.get(nodeId))
			}));

			results.set(def.name, { domains: endState as StateAbstractDomain<AnyStateDomain>, msg, findings });
		}
		return results;
	}

	private wrapFnCallHook(fn: FnCallHook | undefined, name: string, dfg: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): TaintVisitorHook {
		return fn
			? ({ node, value, wasMapped, projectArg, call, role }) => fn({ name, node, value, wasMapped, projectArg, call, dfg, ctx, role })
			: () => {};
	}
}