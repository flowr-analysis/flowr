import type { FlowrAnalyzer, ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import type { TaintAnalysisDefinition, CompositeTaintAnalysisDefinition, RunnableTaintAnalysisDefinition } from './taint-analysis-definition';
import type { AnyPredefinedTaintAnalysisName } from '../predefined/predefined';
import { predefinedTaintAnalyses } from '../predefined/predefined';
import type { AbsintVisitorConfiguration } from '../../abstract-interpretation/absint-visitor';
import type { StateAbstractDomain } from '../../abstract-interpretation/domains/state-abstract-domain';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { AnyStateDomain } from '../../abstract-interpretation/domains/state-domain-like';

export interface TaintInferenceResult {
	domains:  StateAbstractDomain<AnyAbstractDomain>
	finding?: string
}

/**
 * Fluent builder class for conducting taint analyses.
 * Please prefer using the {@link FlowrAnalyzer.taint} method to create a taint analysis.
 */
export class TaintAnalysis<Defs extends readonly string[] = []> {
	private readonly analyzer: ReadonlyFlowrAnalysisProvider;
	private readonly defs:     RunnableTaintAnalysisDefinition<Defs[number]>[] = [];

	constructor(analyzer: ReadonlyFlowrAnalysisProvider) {
		this.analyzer = analyzer;
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
		const baseConfig: AbsintVisitorConfiguration = {
			controlFlow:   await this.analyzer.controlflow(),
			ctx:           this.analyzer.inspectContext(),
			dfg:           (await this.analyzer.dataflow()).graph,
			normalizedAst: await this.analyzer.normalize()
		};
		for(const def of this.defs) {
			const visitor = def.createVisitor(baseConfig);
			visitor.start();

			const endState = visitor.getEndState();

			const finding = endState.isBottom() ? def.msg : undefined;

			results.set(def.name, { domains: endState as StateAbstractDomain<AnyStateDomain>, finding });
		}
		return results;
	}
}
