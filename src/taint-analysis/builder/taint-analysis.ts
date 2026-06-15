import type { FlowrAnalyzer, ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import type { TaintAnalysisDefinition, CompositeTaintAnalysisDefinition, RunnableTaintAnalysisDefinition } from './taint-analysis-definition';
import type { AnyPredefinedTaintAnalysisName } from '../predefined/predefined';
import { predefinedTaintAnalyses } from '../predefined/predefined';
import type { StateAbstractDomain } from '../../abstract-interpretation/domains/state-abstract-domain';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { AnyStateDomain } from '../../abstract-interpretation/domains/state-domain-like';
import type { TaintAnalysisInstrumentation, TaintAnalysisInstrumentationHook } from '../instrumentation';
import type { RNamedFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { ResolvedTaint } from '../function-mapper';
import type { TaintVisitorConfiguration } from '../taint-visitor';

export interface TaintInferenceResult {
	domains:          StateAbstractDomain<AnyAbstractDomain>
	finding?:         string
	instrumentation?: TaintAnalysisInstrumentation
}

/**
 * Fluent builder class for conducting taint analyses.
 * Please prefer using the {@link FlowrAnalyzer.taint} method to create a taint analysis.
 */
export class TaintAnalysis<Defs extends readonly string[] = []> {
	private readonly analyzer:    ReadonlyFlowrAnalysisProvider;
	private readonly defs:        RunnableTaintAnalysisDefinition<Defs[number]>[] = [];
	private readonly fnCallHooks: TaintAnalysisInstrumentationHook[] = [];

	constructor(analyzer: ReadonlyFlowrAnalysisProvider) {
		this.analyzer = analyzer;
	}

	public addInstrumentation(fnCallHook: TaintAnalysisInstrumentationHook): this {
		this.fnCallHooks.push(fnCallHook);
		return this;
	}

	public addPredefined<Name extends AnyPredefinedTaintAnalysisName>(name: Name): TaintAnalysis<readonly [...Defs, Name]> {
		this.defs.push(predefinedTaintAnalyses[name]);
		return this as unknown as TaintAnalysis<readonly [...Defs, Name]>;
	}

	public add<Name extends string>(def: TaintAnalysisDefinition<Name>): TaintAnalysis<readonly [...Defs, Name]> {
		this.defs.push(def);
		return this as unknown as TaintAnalysis<readonly [...Defs, Name]>;
	}

	/**
	 * Add a composite taint analysis that combines multiple taint analyses into a product of their lattice values.
	 * @see {@link TaintAnalysisDefinition.compose} to create a composite taint analysis definition.
	 */
	public addComposite<Name extends string>(def: CompositeTaintAnalysisDefinition<Name>): TaintAnalysis<readonly [...Defs, Name]> {
		this.defs.push(def);
		return this as unknown as TaintAnalysis<readonly [...Defs, Name]>;
	}

	/**
	 * Run one or multiple taint analyses.
	 * Note: Requires a prior call to {@link TaintAnalysis.add}, {@link TaintAnalysis.addComposite}, or {@link TaintAnalysis.addPredefined} to add at least one taint analysis.
	 */
	public async run(): Promise<Map<Defs[number], TaintInferenceResult>> {
		const results: Map<Defs[number], TaintInferenceResult> = new Map();
		for(const def of this.defs) {
			const baseConfig: TaintVisitorConfiguration = {
				controlFlow:   await this.analyzer.controlflow(),
				ctx:           this.analyzer.inspectContext(),
				dfg:           (await this.analyzer.dataflow()).graph,
				normalizedAst: await this.analyzer.normalize(),
				fnCallHooks:   this.fnCallHooks.map(h => {
					return (taint: ResolvedTaint<AnyAbstractDomain>, node: RNamedFunctionCall<ParentInformation>, value: AnyAbstractDomain) =>
						h(def.name, taint, node, value);
				})
			};

			const visitor = def.createVisitor(baseConfig);
			visitor.start();

			const endState = visitor.getEndState();
			const finding = endState.isBottom() ? def.msg : undefined;

			results.set(def.name, { domains: endState as StateAbstractDomain<AnyStateDomain>, finding });
		}
		return results;
	}
}
