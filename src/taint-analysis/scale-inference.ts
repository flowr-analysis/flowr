import { ScaleDomain, Unscaled } from './scale-domain';
import { Top } from '../abstract-interpretation/domains/lattice';
import type { FlowrAnalyzer } from '../project/flowr-analyzer';
import { TaintAnalysis } from './dsl';

/**
 *
 */
export async function runScaleAnalysis(analyzer: FlowrAnalyzer) {
	return await new TaintAnalysis(new ScaleDomain(Top), analyzer)
		.through({
			'c':    { taint: Unscaled },
			//'scale': { taint: Scaled },
			'mean': { taint: Top },
		})
		.run();
}