import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import type { TaintAnalysisDefinition } from './taint-analysis-definition';
import type { PredefinedTaintAnalysis } from '../predefined/predefined';
import { predefinedTaintAnalyses } from '../predefined/predefined';
import { TaintInferenceVisitor } from '../taint-visitor';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';

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

	public addPredefined<Name extends PredefinedTaintAnalysis>(name: Name): TaintAnalysis<readonly [...Defs, Name]> {
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
	public async run(): Promise<Map<Defs[number], TaintInferenceVisitor<AnyAbstractDomain>>> {
		const results: Map<Defs[number], TaintInferenceVisitor<AnyAbstractDomain>> = new Map();
		for(const def of this.defs) {
			const visitor = new TaintInferenceVisitor(def.domain, def.mapper, {
				controlFlow:   await this.analyzer.controlflow(),
				ctx:           this.analyzer.inspectContext(),
				dfg:           (await this.analyzer.dataflow()).graph,
				normalizedAst: await this.analyzer.normalize()
			});
			visitor.start();
			results.set(def.name, visitor);
		}
		return results;
	}
}
