import type { FlowrAnalyzer, ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import type { TaintAnalysisDefinition, TaintAnalysisDomain } from './taint-analysis-definition';
import type { AnyPredefinedTaintAnalysisName } from '../predefined/predefined';
import { predefinedTaintAnalyses } from '../predefined/predefined';
import { TaintInferenceVisitor } from '../taint-visitor';

export interface TaintInferenceResult<Analysis extends TaintAnalysisDefinition> {
	visitor:  TaintInferenceVisitor<TaintAnalysisDomain<Analysis>>
	finding?: string
}

/**
 * Fluent builder class for conducting taint analyses.
 * Please prefer using the {@link FlowrAnalyzer.taint} method to create a taint analysis.
 */
export class TaintAnalysis<Defs extends readonly string[] = []> {
	private readonly analyzer: ReadonlyFlowrAnalysisProvider;
	private readonly defs:     TaintAnalysisDefinition<Defs[number]>[] = [];

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
	 * Run one or multiple taint analyses.
	 * Note: Requires a prior call to {@link TaintAnalysis.add} or {@link TaintAnalysis.addPredefined} to add at least one taint analysis.
	 */
	public async run(): Promise<Map<Defs[number], TaintInferenceResult<TaintAnalysisDefinition<Defs[number]>>>> {
		const results: Map<Defs[number], TaintInferenceResult<TaintAnalysisDefinition<Defs[number]>>> = new Map();
		for(const def of this.defs) {
			const visitor = new TaintInferenceVisitor(def.domain, def.mapper, {
				...def.config,
				controlFlow:   await this.analyzer.controlflow(),
				ctx:           this.analyzer.inspectContext(),
				dfg:           (await this.analyzer.dataflow()).graph,
				normalizedAst: await this.analyzer.normalize()
			});
			visitor.start();

			const endState = visitor.getEndState();
			const finding = endState.isBottom() ? def.msg : undefined;

			results.set(def.name, { visitor, finding });
		}
		return results;
	}
}
